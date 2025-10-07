import React from "react";
import "../styles/footer.css";

const Footer: React.FC = () => {
  return (
    <footer className="app-footer simple">
      <h3>TimeFly</h3>
      <p>Making your time for care smoother and faster.</p>
      <p className="footer-copy">© {new Date().getFullYear()} TimeFly. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
