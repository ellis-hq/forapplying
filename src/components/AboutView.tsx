import React from 'react';
import { Mail, ArrowLeft } from 'lucide-react';

interface AboutViewProps {
  onBack: () => void;
}

const AboutView: React.FC<AboutViewProps> = ({ onBack }) => {
  return (
    <main className="max-w-2xl w-full animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-text-muted hover:text-accent transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="bg-surface rounded-2xl shadow-sm border border-border p-8">
        <h1 className="text-2xl font-bold text-text-primary mb-6">About Forapplying</h1>

        <div className="space-y-4 text-text-secondary">
          <p>
            Forapplying is a professional keyword-mapping engine designed to help job seekers
            optimize their resumes for Applicant Tracking Systems (ATS).
          </p>

          <p>
            Most companies use ATS software to automatically scan and filter resumes before
            a human recruiter ever sees them. Forapplying analyzes job descriptions to identify
            the keywords and skills employers are looking for, then helps you tailor your
            resume to match—increasing your chances of getting past the initial screening
            and landing an interview.
          </p>

          <p>
            Whether you're uploading an existing resume or building one from scratch,
            Forapplying helps ensure your qualifications get the attention they deserve.
          </p>
        </div>

        <hr className="my-8 border-border" />

        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Contact Us</h2>
          <p className="text-text-secondary mb-4">
            For inquiries, feedback, or concerns, please reach out:
          </p>
          <a
            href="mailto:andrew@forapplying.com"
            className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition-colors font-medium"
          >
            <Mail className="w-5 h-5" />
            andrew@forapplying.com
          </a>
        </div>
      </div>
    </main>
  );
};

export default AboutView;
