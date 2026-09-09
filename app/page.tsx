import type { Metadata } from 'next';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import TrustStrip from '../components/landing/TrustStrip';
import Problem from '../components/landing/Problem';
import VoiceToInsight from '../components/landing/VoiceToInsight';
import Privacy from '../components/landing/Privacy';
import DataSources from '../components/landing/DataSources';
import FeatureBento from '../components/landing/FeatureBento';
import Architecture from '../components/landing/Architecture';
import WhyDesktop from '../components/landing/WhyDesktop';
import UseCases from '../components/landing/UseCases';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

export const metadata: Metadata = {
  title: 'SPARK Engine — Talk to Your Data',
  description:
    'SPARK Engine is a voice-first data analytics desktop app. Ask your CSV, MySQL, PostgreSQL, or SQLite data questions in plain English and get answers without writing SQL.',
  keywords: [
    'voice analytics',
    'AI SQL',
    'natural language SQL',
    'database AI',
    'voice to SQL',
    'data analytics',
    'DuckDB analytics',
    'AI database assistant',
    'conversational analytics',
  ],
  openGraph: {
    title: 'SPARK Engine — Talk to Your Data',
    description:
      'Ask your data questions in plain English. SPARK turns your voice into SQL, runs it locally, and speaks the answer back.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SPARK Engine — Talk to Your Data',
    description: 'Ask your data questions in plain English. No SQL required.',
  },
};

export default function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: '#0f0a1a', color: '#e2e8f0' }}
    >
      {/* Subtle background grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(26,18,33,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(26,18,33,0.3) 1px, transparent 1px)',
          backgroundSize: '6rem 6rem',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }}
      />

      <div className="relative z-10">
        <Navbar />
        <Hero />
        <TrustStrip />
        <Problem />
        <VoiceToInsight />
        <Privacy />
        <DataSources />
        <FeatureBento />
        <Architecture />
        <WhyDesktop />
        <UseCases />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}
