"use client";

import Navbar from "./Navbar";
import Hero from "./Hero";
import TrustBar from "./TrustBar";
import ProblemSection from "./ProblemSection";
import SolutionWorkflow from "./SolutionWorkflow";
import ProductTwinSection from "./ProductTwinSection";
import ProductTruthSection from "./ProductTruthSection";
import MissingDataSection from "./MissingDataSection";
import RAGSection from "./RAGSection";
import HealthScoreSection from "./HealthScoreSection";
import HumanReviewSection from "./HumanReviewSection";
import CatalogPilotSection from "./CatalogPilotSection";
import ExportSection from "./ExportSection";
import CategoriesSection from "./CategoriesSection";
import TechnologySection from "./TechnologySection";
import FinalCTA from "./FinalCTA";
import Footer from "./Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-card)' }}>
      <Navbar />
      <main>
        <Hero />
        <TrustBar />
        <ProblemSection />
        <SolutionWorkflow />
        <ProductTwinSection />
        <ProductTruthSection />
        <MissingDataSection />
        <RAGSection />
        <HealthScoreSection />
        <HumanReviewSection />
        <CatalogPilotSection />
        <ExportSection />
        <CategoriesSection />
        <TechnologySection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
