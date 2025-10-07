import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/notfound.css";

// Define props so we can optionally pass a custom message
interface NotFoundProps {
  message?: string;
}

const NotFound: React.FC<NotFoundProps> = ({ message }) => {
  const navigate = useNavigate();

  return (
    <div className="not-found">
      {/* Show 403 if message exists, otherwise 404 */}
      <h1>{message ? "403" : "404"}</h1>
      <p>{message || "Page Not Found"}</p>

      <div className="not-found-actions">
        <button onClick={() => navigate(-1)}>Go Back</button>
        <button onClick={() => navigate("/")}>Go Home</button>
      </div>
    </div>
  );
};

export default NotFound;
