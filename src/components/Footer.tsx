import React from 'react';

const Footer: React.FC = () => (
  <footer className="mt-12 text-text-muted text-xs pb-8 text-center max-w-2xl">
    <p className="mb-2 font-medium">
      Forapplying utilizes semantic mapping to bridge the gap between your unique experience and specific job requirements.
    </p>
    <p>© {new Date().getFullYear()} Forapplying</p>
  </footer>
);

export default Footer;
