import React from "react";
import "../styles/footer.css";

const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* ✅ Brand section: Logo + Title */}
        <div className="footer-brand">
          <img
            src="/images/bird.png"
            alt="TimeFly Logo"
            className="footer-logo"
          />
          <h3 className="footer-title">TimeFly</h3>
        </div>

        {/* ✅ Tagline */}
        <p className="footer-tagline">
          Making your time for care smoother and faster
        </p>

        {/* ✅ Copyright */}
        <div className="footer-copyright">
          <p>© {new Date().getFullYear()} TimeFly. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
