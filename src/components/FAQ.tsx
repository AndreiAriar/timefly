import React, { useState } from "react";
import "../styles/faq.css";

const FAQ: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const faqs = [
    {
      question: "How do I book an appointment?",
      answer:
        "You can book directly through the TimeFly dashboard in just a few clicks. Choose your preferred doctor, date, and time — no need to wait in long lines at St. Paul Hospital Surigao Eye Center."
    },
    {
      question: "Can I reschedule or cancel my appointment?",
      answer:
        "Yes. Log in to your TimeFly account, go to 'My Appointments,' and you can reschedule or cancel as long as it's before your scheduled session."
    },
    {
      question: "What services does St. Paul Hospital Surigao Eye Center offer?",
      answer:
        "We provide comprehensive eye care — including visual acuity testing, refraction exams, cataract evaluation, glaucoma screening, and minor eye procedures — handled by certified ophthalmologists and optometrists."
    },
    {
      question: "Is TimeFly secure and reliable?",
      answer:
        "Absolutely. TimeFly uses encrypted communication and secure authentication to ensure that your personal information and appointment data are always protected."
    },
    {
      question: "Can I access TimeFly on my mobile device?",
      answer:
        "Yes! The TimeFly platform is fully responsive — you can access it from your phone, tablet, or desktop, making it easy to manage your appointments anytime, anywhere."
    },
    {
      question: "Where is St. Paul Hospital Surigao Eye Center located?",
      answer:
        "We are located within St. Paul Hospital Surigao, along Borromeo Street, Surigao City. Visit our eye center for expert consultations and patient-focused care."
    },
    {
      question: "How can I contact the Eye Center for urgent concerns?",
      answer:
        "You may reach us through the TimeFly contact form or directly at the St. Paul Hospital Surigao Eye Center front desk. Our staff will be glad to assist you during operating hours."
    }
  ];

  return (
    <div className="faq-page">
      <section className="faq-section">
        <div className="faq-container">
          {/* Left Side Image */}
          <div className="faq-image">
            <img
              src="/images/faqbg.png"
              alt="FAQ Illustration"
              className="faq-img"
            />
          </div>

          {/* Right Side FAQ */}
          <div className="faq-content">
            <h1>Frequently Asked Questions</h1>

            {faqs.map((faq, index) => (
              <div key={index} className="faq-item">
                <div className="faq-question" onClick={() => toggleFAQ(index)}>
                  <h3>{faq.question}</h3>
                  <span
                    className={`toggle-icon ${activeIndex === index ? "open" : ""}`}
                  >
                    <span className="line vertical"></span>
                    <span className="line horizontal"></span>
                  </span>
                </div>
                <div
                  className={`faq-answer ${activeIndex === index ? "show" : ""}`}
                >
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default FAQ;