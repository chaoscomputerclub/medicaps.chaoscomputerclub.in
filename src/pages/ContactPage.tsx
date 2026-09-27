import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PublicNavbar } from "../components/public/PublicNavbar";
import { PublicFooter } from "../components/public/PublicFooter";
import { Mail, MapPin, Shield, CheckCircle, Terminal, Send, Building, Clock } from "lucide-react";

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "general",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate submission acknowledgment
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-[#CCFF00]/30 selection:text-white flex flex-col font-sans antialiased">
      <PublicNavbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Header */}
        <header className="border-b border-white/10 pb-8 mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00] font-mono text-xs mb-4">
            <Mail className="w-3.5 h-3.5" />
            <span>Communications &amp; Chapter Support</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono">
            Contact Chaos Computer Club Medi-Caps
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-300 max-w-3xl leading-relaxed">
            Reach out to our chapter administration, faculty mentors, or technical committee regarding competitions, data rights, or organizational inquiries.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Contact Information & Channels */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-lg border border-white/10 bg-zinc-950/60">
              <h2 className="text-base font-bold text-white font-mono mb-4 flex items-center gap-2">
                <Building className="w-4 h-4 text-[#CCFF00]" /> Chapter Headquarters
              </h2>
              <address className="not-italic text-sm text-zinc-300 space-y-2">
                <p className="font-semibold text-white">Chaos Computer Club Medi-Caps</p>
                <p>Department of Computer Science &amp; Engineering</p>
                <p>Medi-Caps University</p>
                <p>A.B. Road, Pigdamber, Rau</p>
                <p>Indore, Madhya Pradesh 453331, India</p>
              </address>
              <div className="mt-4 pt-4 border-t border-white/10 text-xs font-mono text-zinc-400 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#CCFF00]" /> Lab Hours: Mon–Fri, 09:00 – 17:00 IST
              </div>
            </div>

            <div className="p-6 rounded-lg border border-white/10 bg-zinc-950/60 space-y-4">
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#CCFF00]" /> Direct Inquiries
              </h2>

              <div>
                <span className="text-xs font-mono text-zinc-400 block">General Chapter &amp; Event Inquiries</span>
                <a
                  href="mailto:info@chaoscomputerclub.in"
                  className="font-mono text-sm text-[#CCFF00] hover:underline"
                >
                  info@chaoscomputerclub.in
                </a>
              </div>

              <div>
                <span className="text-xs font-mono text-zinc-400 block">Data Privacy &amp; Deletion Requests</span>
                <a
                  href="mailto:privacy@chaoscomputerclub.in"
                  className="font-mono text-sm text-[#CCFF00] hover:underline"
                >
                  privacy@chaoscomputerclub.in
                </a>
              </div>

              <div>
                <span className="text-xs font-mono text-zinc-400 block">Responsible Security Disclosure</span>
                <a
                  href="mailto:security@chaoscomputerclub.in"
                  className="font-mono text-sm text-[#CCFF00] hover:underline"
                >
                  security@chaoscomputerclub.in
                </a>
              </div>
            </div>

            <div className="p-5 rounded-lg border border-[#CCFF00]/20 bg-[#CCFF00]/5 text-xs text-zinc-300 font-mono">
              <strong className="text-white block mb-1">For Enrolled Medi-Caps Students:</strong>
              Please include your Enrollment Number / PRN and university email address when inquiring about contest ratings or qualification results.
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-7">
            <div className="p-8 rounded-lg border border-white/10 bg-zinc-950/60">
              <h2 className="text-xl font-bold text-white font-mono mb-2">Send a Message</h2>
              <p className="text-xs text-zinc-400 mb-6">
                Messages are routed to the student technical leads and chapter faculty mentors.
              </p>

              {submitted ? (
                <div className="p-6 rounded border border-[#CCFF00]/30 bg-[#CCFF00]/10 text-center space-y-3">
                  <CheckCircle className="w-10 h-10 text-[#CCFF00] mx-auto" />
                  <h3 className="font-mono font-bold text-white text-base">Message Transmitted</h3>
                  <p className="text-xs text-zinc-300 max-w-sm mx-auto">
                    Thank you for reaching out. A chapter coordinator will reply to your registered email address shortly.
                  </p>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: "", email: "", subject: "general", message: "" });
                    }}
                    className="mt-4 px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-white transition-colors"
                  >
                    Send Another Transmission
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-mono text-zinc-300 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Cadet Alan Turing"
                      className="w-full px-3.5 py-2.5 rounded bg-zinc-900 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#CCFF00] focus:border-transparent font-sans"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-mono text-zinc-300 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. user@medicaps.ac.in"
                      className="w-full px-3.5 py-2.5 rounded bg-zinc-900 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#CCFF00] focus:border-transparent font-sans"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className="block text-xs font-mono text-zinc-300 mb-1.5">
                      Transmission Purpose *
                    </label>
                    <select
                      id="contact-subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#CCFF00] focus:border-transparent font-sans"
                    >
                      <option value="general">General Chapter Inquiries</option>
                      <option value="privacy">Privacy &amp; Data Deletion Request</option>
                      <option value="contest">Contest Evaluation / Rating Appeal</option>
                      <option value="security">Vulnerability Disclosure</option>
                      <option value="sponsorship">Sponsorship &amp; Workshop Coordination</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-mono text-zinc-300 mb-1.5">
                      Message *
                    </label>
                    <textarea
                      id="contact-message"
                      rows={5}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Detail your inquiry or issue..."
                      className="w-full px-3.5 py-2.5 rounded bg-zinc-900 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#CCFF00] focus:border-transparent font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded bg-[#CCFF00] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#b8e600] transition-colors flex items-center justify-center gap-2 mt-4"
                  >
                    <Send className="w-3.5 h-3.5" /> Transmit Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default ContactPage;
