import type { Metadata } from 'next';
import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import ProductPreview from '../components/landing/ProductPreview';
import HowItWorks from '../components/landing/HowItWorks';
import StudioGrid from '../components/landing/StudioGrid';
import Manifesto from '../components/landing/Manifesto';
import FinalCTA from '../components/landing/FinalCTA';
import Footer from '../components/landing/Footer';

export const metadata: Metadata = {
  title: 'SPARK Engine — Talk to Your Data',
  description:
    'Ask your CSV, database, or data source questions in plain English. SPARK writes the SQL, runs it locally, and explains what it found.',
  keywords: [
    'AI analytics',
    'natural language SQL',
    'database AI',
    'voice to SQL',
    'data analytics',
    'DuckDB',
    'conversational analytics',
  ],
  openGraph: {
    title: 'SPARK Engine — Talk to Your Data',
    description:
      'Ask your data questions in plain English. SPARK turns your question into SQL, runs it locally, and explains the answer.',
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
    <div style={{ background: '#0A0A0A', color: '#F5F5F5' }}>
      <Navbar />
      <Hero />
      <ProductPreview />
      <HowItWorks />
      <StudioGrid />
      <Manifesto />
      <FinalCTA />
      <Footer />
    </div>
  );
}
