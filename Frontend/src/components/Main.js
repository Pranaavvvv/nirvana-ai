import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Typewriter from "react-typewriter";
import "./Main.css";
import { assets } from "../assets/assets";

const Main = () => {
  const [moodValue, setMoodValue] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(0);
  const [userMessage, setUserMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const chatEndRef = useRef(null);

  // Generate or retrieve unique user ID
  useEffect(() => {
    const storedUserId = localStorage.getItem("mindspaceUserId");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(
        2,
        9
      )}`;
      setUserId(newUserId);
      localStorage.setItem("mindspaceUserId", newUserId);
    }
  }, []);

  // Fetch welcome message
  useEffect(() => {
    const fetchWelcomeMessage = async () => {
      try {
        const response = await axios.get("http://localhost:5555/api/welcome");
        setWelcomeMessage(response.data.message);

        // Automatically start conversation with welcome message
        setChatHistory([
          { type: "ai", content: response.data.message },
        ]);
      } catch (error) {
        console.error("Failed to fetch welcome message", error);
      }
    };

    fetchWelcomeMessage();
  }, []);

  // Scroll to bottom of chat when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleMoodChange = (e) => {
    const newValue = parseInt(e.target.value);
    setMoodValue(newValue);
    setSliderPosition(e.target.value);
  };

  const handleMessageChange = (e) => {
    setUserMessage(e.target.value);
  };

  const handleSendMessage = async () => {
    if (!userMessage.trim() || isLoading) return;

    setIsLoading(true);
    try {
      // Add user message to chat history
      setChatHistory((prevHistory) => [
        ...prevHistory,
        { type: "user", content: userMessage },
      ]);

      const response = await axios.post("http://localhost:5555/api/chat", {
        moodValue: moodValue,
        userMessage: userMessage,
        userId: userId,
      });

      // Add AI response to chat history
      setChatHistory((prevHistory) => [
        ...prevHistory,
        {
          type: "ai",
          content: response.data.response,
        },
        {
          type: "follow-up",
          content: response.data.followUp,
        },
      ]);

      setUserMessage(""); // Clear input after sending
    } catch (error) {
      console.error("Error sending message:", error);
      setChatHistory((prevHistory) => [
        ...prevHistory,
        {
          type: "error",
          content: "Sorry, there was an error processing your message. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Mood Interpretation
  const getMoodInterpretation = (value) => {
    if (value > 40) return "Extremely Positive";
    if (value > 20) return "Very Good";
    if (value > 0) return "Somewhat Positive";
    if (value === 0) return "Neutral";
    if (value > -20) return "Somewhat Negative";
    if (value > -40) return "Very Challenging";
    return "Critically Distressed";
  };

  return (
    <div className="Main">
      <div className="main-container">
        <div className="greet">
          <p>
            <span>Hello</span>
          </p>
          <p>How are you feeling Today?</p>
        </div>

        <div className="slider-wrapper">
          <h4>How would you rate your current mental state?</h4>
          <div className="slider-container">
            <input
              type="range"
              min="-50"
              max="50"
              value={moodValue}
              onChange={handleMoodChange}
              className="slider"
            />
            <div
              className="value-display"
              style={{
                left: `${((sliderPosition + 50) * 100) / 100}%`,
                transform: `translateX(-${((sliderPosition + 50) * 100) / 100}%)`,
              }}
            >
              {moodValue}
            </div>
          </div>
          <p>
            You have selected <strong>{Math.abs(moodValue)}</strong>{" "}
            {moodValue >= 0 ? "positive" : "negative"} units. Current mood
            interpretation: <strong>{getMoodInterpretation(moodValue)}</strong>
          </p>
        </div>

        {/* Chat history display */}
        <div className="chat-history">
          {chatHistory.map((message, index) => (
            <div key={index} className={`message ${message.type}`}>
              {message.type === "ai" ? (
                <Typewriter typing={1.9}>{message.content}</Typewriter>
              ) : message.type === "follow-up" ? (
                <div className="follow-up">
                  <em>{message.content}</em>
                </div>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          ))}
          <div ref={chatEndRef} /> {/* Anchor for scrolling */}
        </div>

        <div className="main-bottom">
          <div className="search-box">
            <input
              type="text"
              placeholder="Enter your message here"
              value={userMessage}
              onChange={handleMessageChange}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={isLoading}
            />
            <div>
              <img src={assets.gallery_icon} alt="" />
              <img src={assets.mic_icon} alt="" />
              <img
                src={assets.send_icon}
                alt="Send"
                onClick={handleSendMessage}
                style={{
                  cursor: isLoading ? "wait" : "pointer",
                  opacity: isLoading ? 0.5 : 1,
                }}
              />
            </div>
          </div>
          {isLoading && (
            <div className="loading-indicator">Thinking...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Main;