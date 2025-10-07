import React from "react";
import "../styles/about.css";
import { Eye, Users, HeartPulse, ShieldCheck } from "lucide-react";

const About: React.FC = () => {
  return (
    <div className="about-page">
      {/* ===== HERO SECTION ===== */}
      <section className="about-hero">
        <img
          src="/images/opticalimg.png"
          alt="Optical Equipment"
          className="hero-bg-image"
        />
        <div className="hero-overlay"></div>

        <div className="hero-text-container">
          <h1>Advanced Optical Care, Backed by Experts</h1>
          <p>Medically supervised eye care for a clearer tomorrow.</p>
        </div>
      </section>

      {/* ===== FEATURE CARDS SECTION ===== */}
      <section className="feature-section">
        <div className="feature-card">
          <Eye size={30} />
          <p>State-of-the-art Optical Equipment</p>
        </div>

        <div className="feature-card">
          <Users size={30} />
          <p>Expert Optical Specialists</p>
        </div>

        <div className="feature-card">
          <HeartPulse size={30} />
          <p>Personalized Patient Care</p>
        </div>

        <div className="feature-card">
          <ShieldCheck size={30} />
          <p>Trusted Medical Excellence</p>
        </div>
      </section>

      {/* ===== CONTENT SECTION ===== */}
      <section className="about-content">
        <div className="about-intro">
          <h2>Welcome to TimeFly Eye Center</h2>
          <p>
            At <b>TimeFly</b>, we merge innovation with compassionate care to provide 
            seamless optical experiences. From modern diagnostic tools to 
            personalized treatment, our focus is clear vision and patient comfort.
          </p>
          <p>
            With our dedicated specialists and technology-driven approach, we 
            ensure precision, comfort, and trust in every visit.
          </p>
        </div>
      </section>
    </div>
  );
};

export default About;
