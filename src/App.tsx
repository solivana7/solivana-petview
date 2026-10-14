import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import type { ScanAnalysis, ScanArea } from "../api/scanRouter";
import { preprocessFile } from "@/lib/image";
import { getDeviceId, getUnlockToken, setUnlockToken } from "@/lib/device";
import { getSessionToken, setSessionToken, clearSessionToken, withCoupon } from "@/lib/account";
import { getConsent, setConsent, setStorageItem, removeStorageItem } from "@/lib/consent";
import { PET_IMG } from "@/lib/pet-images";
import "./App.css";

type Screen = "home" | "tips" | "capture" | "analyzing" | "result" | "about" | "science" | "admin" | "paywall" | "unlock" | "auth" | "signin" | "account" | "innerview_capture" | "innerview_analyzing" | "innerview_result";
type Species = "dog" | "cat";

interface PaymentLinks { starter: string; pro: string; unlimited: string; unlimitedAnnual?: string }

const BUILD_TIME = "2026-05-16T19:50:00Z";
const VET_DISCLAIMER = "PetView is a photo-based observation tool. It is not a veterinary diagnostic device, does not diagnose any condition, and is not a substitute for licensed veterinary care. Always consult your veterinarian for diagnosis and treatment decisions.";

/* ─── AREAS (matches scanRouter SCAN_AREAS exactly) ─── */
const AREAS: { id: ScanArea; label: string; short: string; guideImg: string; scanImg: string; tipImg: string; about: string; whatWeRead: string[]; tcmNote: string }[] = [
  {
    id: "nose",
    label: "Nose",
    short: "Pigment, moisture, crusting",
    guideImg: PET_IMG.guideNose,
    scanImg: PET_IMG.scanNose,
    tipImg: PET_IMG.tipNose,
    about: "The nose tells a quiet story — color shifts, dry patches, crusting, asymmetry. Veterinary literature has used the nasal planum as a screening surface for decades.",
    whatWeRead: ["Pigmentation (color, depigmentation)", "Moisture and crusting", "Discharge or asymmetry"],
    tcmNote: "In TCM, the nose relates to Lung Qi and the body's protective Wei Qi. Dryness or discoloration can signal energy imbalance.",
  },
  {
    id: "eye",
    label: "Eyes",
    short: "Cornea, conjunctiva, sclera",
    guideImg: PET_IMG.guideEye,
    scanImg: PET_IMG.scanEye,
    tipImg: PET_IMG.tipEye,
    about: "Eyes are one of the most sensitive screening surfaces. CNN models in IEEE/Equine Vet Journal work have shown 90-100% accuracy on smartphone eye photos for several conditions.",
    whatWeRead: ["Conjunctiva color and discharge", "Corneal clarity", "Third-eyelid visibility & sclera"],
    tcmNote: "Ayurveda sees the eyes as a window to Pitta (fire) balance. Redness or cloudiness may reflect inner heat or liver stress.",
  },
  {
    id: "ear",
    label: "Ears",
    short: "Position, redness, debris",
    guideImg: PET_IMG.guideEar,
    scanImg: PET_IMG.scanEar,
    tipImg: PET_IMG.tipEar,
    about: "Ears flag chronic issues earlier than most owners notice. Position, color, and waxy buildup are the obvious cues — often the first sign before scratching becomes constant.",
    whatWeRead: ["Position & symmetry", "Redness, swelling, debris", "Hair loss in/around the ear"],
    tcmNote: "Ear position and temperature mirror Kidney and Liver meridian flow in TCM. Chronic ear issues often trace to underlying systemic patterns.",
  },
  {
    id: "mouth",
    label: "Mouth & Gums",
    short: "Gum color, tartar, lips",
    guideImg: PET_IMG.guideMouth,
    scanImg: PET_IMG.scanMouth,
    tipImg: PET_IMG.tipMouth,
    about: "80% of dogs over three show signs of dental disease, yet 72% of owners think their pet's oral health is great. Mars trained their GREENIES tool on 53,000 mouth photos — this is the highest-yield single area.",
    whatWeRead: ["Gum color (pink/pale/red/blue)", "Tartar accumulation", "Tooth fractures or discoloration"],
    tcmNote: "Bioenergetics maps gum color to blood vitality and circulation. Pale gums suggest deficiency; deep red points to excess heat in the system.",
  },
];

/* ─── ICONS ─── */
const I = {
  Paw:    ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><circle cx="6" cy="9" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="18" cy="9" r="2"/><path d="M8 15c0-2.5 1.5-4 4-4s4 1.5 4 4-2 5-4 5-4-2.5-4-5z"/></svg>,
  Camera: ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Image:  ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
  Sun:    ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  Frame:  ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="4"/></svg>,
  Treat:  ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M1 12h6M17 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/></svg>,
  Steady: ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><path d="M5 12h14M12 5l7 7-7 7"/></svg>,
  NoFlash:({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Sparkle:({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z"/></svg>,
  Close:  ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={c} aria-hidden><path d="M18 6L6 18M6 6l12 12"/></svg>,
  ArrowR: ({ c = "w-4 h-4" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={c} aria-hidden><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  ArrowL: ({ c = "w-4 h-4" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={c} aria-hidden><path d="M19 12H5M11 5l-7 7 7 7"/></svg>,
  Alert:  ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Heart:  ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Lock:   ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Check:  ({ c = "w-4 h-4" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className={c} aria-hidden><path d="M5 13l4 4L19 7"/></svg>,
  Settings: ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Logout: ({ c = "w-5 h-5" }: { c?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={c} aria-hidden><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

/* ─── AUDIO ─── */
function playChime(type: "capture" | "success" | "bloom" | "error") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "capture") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "bloom") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === "error") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Audio not available
  }
}

function triggerHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(12);
  }
}

/* ─── SHARE CARD ─── */
function generateShareCard(result: ScanAnalysis, species: string, petName?: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Background
  ctx.fillStyle = "#FFF8F0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top brand bar
  ctx.fillStyle = "#331D01";
  ctx.fillRect(0, 0, canvas.width, 8);

  // Logo text
  ctx.fillStyle = "#331D01";
  ctx.font = "500 28px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PetView", canvas.width / 2, 80);
  ctx.font = "400 16px Jost, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillStyle = "#D4A574";
  ctx.fillText("BY SOLIVANA", canvas.width / 2, 110);

  // Species + date
  ctx.fillStyle = "#786455";
  ctx.font = "400 20px Poppins, sans-serif";
  ctx.textAlign = "center";
  const dateStr = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const displayName = petName ? petName.charAt(0).toUpperCase() + petName.slice(1) : species.charAt(0).toUpperCase() + species.slice(1);
  ctx.fillText(`${displayName}'s wellness reading · ${dateStr}`, canvas.width / 2, 170);

  // Score ring
  const score = result.overallStatus === "looking_healthy" ? 85 : result.overallStatus === "worth_watching" ? 65 : result.overallStatus === "share_with_vet" ? 45 : 0;
  const cx = canvas.width / 2;
  const cy = 340;
  const r = 100;
  const color = score >= 80 ? "#8FAE8F" : score >= 50 ? "#D4A574" : "#C4847A";

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = "#F0EDED";
  ctx.lineWidth = 14;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (score / 100) * 2 * Math.PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.fillStyle = "#331D01";
  ctx.font = "300 72px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(score), cx, cy + 20);
  ctx.font = "400 18px Poppins, sans-serif";
  ctx.fillStyle = "#786455";
  ctx.fillText("/ 100", cx, cy + 48);

  // Status label
  const badgeLabel = result.overallStatus === "looking_healthy" ? "Looking healthy" : result.overallStatus === "worth_watching" ? "A few things to watch" : result.overallStatus === "share_with_vet" ? "Share with your vet" : "Photos weren't clear";
  ctx.fillStyle = color;
  ctx.font = "500 22px Montserrat, sans-serif";
  ctx.fillText(badgeLabel, cx, cy + 155);

  // Note excerpt
  ctx.fillStyle = "#331D01";
  ctx.font = "400 22px Poppins, sans-serif";
  ctx.textAlign = "center";
  const note = result.overallNote.split("\n\n")[0] ?? result.overallNote;
  const maxChars = 90;
  const excerpt = note.length > maxChars ? note.slice(0, maxChars) + "…" : note;
  const words = excerpt.split(" ");
  let line = "";
  let y = 560;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > 800 && line) {
      ctx.fillText(line.trim(), cx, y);
      line = word + " ";
      y += 36;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line.trim(), cx, y);

  // Emotional View badge if present
  if (result.innerview) {
    y += 50;
    ctx.fillStyle = "#D4A574";
    ctx.font = "500 18px Jost, sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillText("EMOTIONAL VIEW INCLUDED", cx, y);
  }

  // QR code placeholder / URL
  y = canvas.height - 120;
  ctx.fillStyle = "#331D01";
  ctx.font = "400 18px Poppins, sans-serif";
  ctx.fillText("Scan your pet at", cx, y);
  ctx.fillStyle = "#D4A574";
  ctx.font = "500 22px Montserrat, sans-serif";
  ctx.fillText("pets.solivana.io", cx, y + 34);

  return canvas.toDataURL("image/png");
}

function generateEmotionalViewCard(opts: {
  dominantEmotion: string;
  confidence: number;
  contextualNote?: string;
  textExcerpt: string;
  sectionLabel?: string;
  species: string;
  petName?: string;
}): string {
  const { dominantEmotion, confidence, contextualNote, textExcerpt, sectionLabel, species, petName } = opts;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#FFF8F0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#331D01";
  ctx.fillRect(0, 0, canvas.width, 8);

  // Logo
  ctx.fillStyle = "#331D01";
  ctx.font = "500 28px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PetView", canvas.width / 2, 80);
  ctx.font = "400 16px Jost, sans-serif";
  ctx.fillStyle = "#D4A574";
  ctx.fillText("BY SOLIVANA", canvas.width / 2, 110);

  // Heading
  ctx.fillStyle = "#786455";
  ctx.font = "400 22px Poppins, sans-serif";
  const displayName = petName ? petName.charAt(0).toUpperCase() + petName.slice(1) : species.charAt(0).toUpperCase() + species.slice(1);
  const dateStr = new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  ctx.fillText(`${displayName} · Emotional View · ${dateStr}`, canvas.width / 2, 180);

  // Dominant emotion
  const emotionColors: Record<string, string> = {
    Happy: "#7FB069", Sad: "#5B7B9C", Anxious: "#E0A458", Relaxed: "#7FB069",
    Alert: "#D4A574", "In Pain": "#C4847A", Neutral: "#A89B91",
  };
  ctx.font = "400 28px Jost, sans-serif";
  ctx.fillStyle = "#786455";
  ctx.fillText("DOMINANT EMOTION", canvas.width / 2, 270);

  ctx.font = "300 110px Montserrat, sans-serif";
  ctx.fillStyle = emotionColors[dominantEmotion] || "#D4A574";
  ctx.fillText(dominantEmotion, canvas.width / 2, 380);

  ctx.font = "400 22px Poppins, sans-serif";
  ctx.fillStyle = "#786455";
  ctx.fillText(`${Math.round(confidence)}% confidence`, canvas.width / 2, 430);

  // Optional section label above the prose (small, uppercase, accent)
  let y = 520;
  if (sectionLabel) {
    ctx.font = "500 18px Jost, sans-serif";
    ctx.fillStyle = "#D4A574";
    ctx.textAlign = "center";
    ctx.fillText(sectionLabel.toUpperCase(), canvas.width / 2, y);
    y += 50;
  } else {
    y = 540;
  }

  // Reading excerpt — wrap to multiple lines
  ctx.fillStyle = "#331D01";
  ctx.font = "400 26px Poppins, sans-serif";
  ctx.textAlign = "center";
  const excerpt = textExcerpt.length > 360 ? textExcerpt.slice(0, 360).replace(/\s+\S*$/, "") + "…" : textExcerpt;
  const words = excerpt.split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > 880 && line) {
      ctx.fillText(line.trim(), canvas.width / 2, y);
      line = word + " ";
      y += 40;
      if (y > 980) { line = ""; break; }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line.trim(), canvas.width / 2, y);

  // Contextual note (italic)
  if (contextualNote && y < 940) {
    y += 70;
    ctx.font = "italic 400 22px Poppins, sans-serif";
    ctx.fillStyle = "#786455";
    const note = contextualNote.length > 140 ? contextualNote.slice(0, 140).replace(/\s+\S*$/, "") + "…" : contextualNote;
    const noteWords = note.split(/\s+/);
    let nLine = "";
    for (const word of noteWords) {
      const test = nLine + word + " ";
      if (ctx.measureText(test).width > 820 && nLine) {
        ctx.fillText(nLine.trim(), canvas.width / 2, y);
        nLine = word + " ";
        y += 32;
      } else {
        nLine = test;
      }
    }
    if (nLine) ctx.fillText(nLine.trim(), canvas.width / 2, y);
  }

  // Footer URL
  y = canvas.height - 120;
  ctx.font = "400 18px Poppins, sans-serif";
  ctx.fillStyle = "#331D01";
  ctx.fillText("Read your pet at", canvas.width / 2, y);
  ctx.fillStyle = "#D4A574";
  ctx.font = "500 22px Montserrat, sans-serif";
  ctx.fillText("petview.solivana.io", canvas.width / 2, y + 34);

  return canvas.toDataURL("image/png");
}

function dataUrlToFile(dataUrl: string, filename: string): File | null {
  try {
    const [meta, b64] = dataUrl.split(",");
    if (!meta || !b64) return null;
    const mimeMatch = meta.match(/data:(.*?);base64/);
    const mime = mimeMatch?.[1] ?? "image/png";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

function ShareModal({ open, onClose, dataUrl, filename, shareUrl, shareText }: {
  open: boolean;
  onClose: () => void;
  dataUrl: string;
  filename: string;
  shareUrl: string;
  shareText: string;
}) {
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [imageCopyFailed, setImageCopyFailed] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopiedImage(false);
      setCopiedLink(false);
      setImageCopyFailed(false);
    }
  }, [open]);

  if (!open) return null;

  const copyImage = async () => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      // ClipboardItem with image/png — supported in Chrome, Edge, Safari 16.4+
      const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (!ClipboardItemCtor || !navigator.clipboard?.write) throw new Error("no clipboard image support");
      await navigator.clipboard.write([new ClipboardItemCtor({ "image/png": blob })]);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2500);
    } catch {
      setImageCopyFailed(true);
      setTimeout(() => setImageCopyFailed(false), 3000);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  };

  const downloadImage = () => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brown/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="bg-soft rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-[0_24px_64px_-16px_rgba(51,29,1,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-coffee/15 flex items-center justify-between">
          <h2 id="share-modal-title" className="font-heading text-lg text-brown">Share your reading</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full hover:bg-coffee/10 flex items-center justify-center text-coffeeText"
          >×</button>
        </div>
        <div className="p-6">
          <img
            src={dataUrl}
            alt="Your reading shareable card"
            className="w-full rounded-2xl border border-coffee/20 mb-5 shadow-sm"
          />
          <p className="text-sm text-coffeeText mb-5 leading-relaxed">{shareText}</p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={copyImage}
              className="w-full px-5 py-3 rounded-full bg-accent text-white font-heading text-sm hover:opacity-90 transition-opacity"
            >
              {copiedImage ? "✓ Image copied — paste it anywhere" : imageCopyFailed ? "Image copy failed — use Download" : "Copy image"}
            </button>
            <button
              onClick={copyLink}
              className="w-full px-5 py-3 rounded-full border border-coffee/30 bg-paper text-brown font-heading text-sm hover:bg-coffee/5 transition-colors"
            >
              {copiedLink ? "✓ Link copied" : "Copy link to petview.solivana.io"}
            </button>
            <button
              onClick={downloadImage}
              className="w-full px-5 py-3 rounded-full text-coffeeText font-heading text-sm hover:text-brown transition-colors"
            >
              Download image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── STYLE TOKENS ─── */
const cls = {
  container: "max-w-7xl mx-auto px-6 lg:px-12",
  label: "font-hero text-xs tracking-[0.32em] uppercase text-coffeeText",
  labelAccent: "font-hero text-xs tracking-[0.32em] uppercase text-accent",
  h1: "font-hero font-light text-brown leading-[1.05] tracking-tight",
  h2: "font-heading font-light text-brown leading-[1.15] tracking-tight",
  body: "font-body text-coffeeText leading-relaxed",
  card: "bg-paper border border-coffee/30 rounded-2xl p-6",
  btnPrimary: "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-accent text-white font-heading font-medium text-sm tracking-wide hover:bg-accent/90 active:scale-[0.98] transition-all touch-min",
  btnSecondary: "inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-brown/30 text-brown font-heading font-medium text-sm tracking-wide hover:bg-coffeeLight active:scale-[0.98] transition-all touch-min",
  btnGhost: "inline-flex items-center gap-1.5 text-sm font-heading text-accent hover:text-brown transition-colors touch-min",
};

/* ═══════════════════════════════════════════════════════════ */
/*  HEADER + SETTINGS MENU                                      */
/* ═══════════════════════════════════════════════════════════ */
function SettingsDropdown({ signedIn, email, onAccount, onSignOut, onAdmin }: { signedIn: boolean; email: string | null; onAccount?: () => void; onSignOut?: () => void; onAdmin?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Settings menu" aria-expanded={open} className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-paper border border-coffee/30 text-coffeeText hover:text-brown hover:border-accent/50 transition-colors touch-min">
        <I.Settings c="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-paper border border-coffee/30 rounded-xl shadow-lg z-50 overflow-hidden">
          {signedIn && email && (
            <div className="px-4 py-3 border-b border-coffee/20">
              <p className="text-xs text-coffeeText font-hero tracking-wider uppercase">Signed in as</p>
              <p className="text-sm text-brown font-heading truncate">{email}</p>
            </div>
          )}
          <div className="py-1">
            {signedIn && onAccount && (
              <button onClick={() => { setOpen(false); onAccount(); }} className="w-full text-left px-4 py-2.5 text-sm text-brown hover:bg-coffeeLight transition-colors flex items-center gap-2">
                <span className="text-base">👤</span> Account
              </button>
            )}
            {signedIn && onAdmin && (
              <button onClick={() => { setOpen(false); onAdmin(); }} className="w-full text-left px-4 py-2.5 text-sm text-brown hover:bg-coffeeLight transition-colors flex items-center gap-2">
                <span className="text-base">🛠️</span> Admin
              </button>
            )}
            {signedIn && onSignOut && (
              <button onClick={() => { setOpen(false); onSignOut(); }} className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors flex items-center gap-2 border-t border-coffee/20 mt-1">
                <I.Logout c="w-4 h-4" /> Log out
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Cookie Consent Banner ─── */
function CookieBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (getConsent() === null) setVisible(true);
  }, []);
  const accept = () => { setConsent("accepted"); setVisible(false); };
  const decline = () => { setConsent("declined"); setVisible(false); };
  if (!visible) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-coffee/20 px-4 py-4 sm:py-5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className={cls.container + " flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between"}>
        <div className="flex-1">
          <p className="font-heading text-sm text-brown mb-1">Your privacy matters to us</p>
          <p className="text-xs text-coffeeText leading-relaxed">
            We use local storage to keep you signed in and remember your preferences.
            We never sell your data or use third-party tracking cookies.
            <a href="https://tools.solivana.io/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline ml-1">Privacy Policy</a>
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={decline} className={cls.btnGhost + " text-xs !py-2.5 !px-4 touch-min"}>Decline optional cookies</button>
          <button onClick={accept} className={cls.btnPrimary + " text-xs !py-2.5 !px-5 touch-min"}>Accept</button>
        </div>
      </div>
    </div>
  );
}

function ScanModeSwitcher({ active, onInnerView, onFullScan }: { active: "innerview" | "full"; onInnerView: () => void; onFullScan: () => void }) {
  const baseBtn = "flex-1 px-4 py-3 rounded-full font-heading text-sm transition-all touch-min text-center";
  const activeCls = " bg-accent text-white shadow-sm";
  const inactiveCls = " text-coffeeText hover:text-brown";
  return (
    <div className="bg-paper border border-coffee/30 rounded-full p-1 flex gap-1 mb-8 max-w-xl" role="tablist" aria-label="Choose scan type">
      <button
        type="button"
        role="tab"
        aria-selected={active === "innerview"}
        onClick={active === "innerview" ? undefined : onInnerView}
        className={baseBtn + (active === "innerview" ? activeCls : inactiveCls)}
      >
        <span className="inline-block">Emotional only</span>
        <span className="hidden sm:inline text-xs opacity-70 font-normal ml-2">· 1 photo</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "full"}
        onClick={active === "full" ? undefined : onFullScan}
        className={baseBtn + (active === "full" ? activeCls : inactiveCls)}
      >
        <span className="inline-block">Wellness Scan</span>
        <span className="hidden sm:inline text-xs opacity-70 font-normal ml-2">· 4 photos</span>
      </button>
    </div>
  );
}

function Header({ onAbout, onScan, onSignin, onAccount, onSignOut, onScience, onAdmin }: { onAbout: () => void; onScan: () => void; onSignin?: () => void; onAccount?: () => void; onSignOut?: () => void; onScience?: () => void; onAdmin?: () => void }) {
  const sessionToken = getSessionToken();
  const status = trpc.access.myStatus.useQuery({ sessionToken }, { enabled: Boolean(sessionToken), refetchInterval: 30_000, staleTime: 10_000 });
  const data = status.data;
  const signedIn = data?.signedIn === true;
  const credits = signedIn ? data.totalCredits : 0;
  const hasUnlimited = signedIn && data.hasUnlimited;
  const email = signedIn ? data.email : null;

  return (
    <header className="sticky top-0 z-30 bg-soft/85 supports-[backdrop-filter]:bg-soft/85 backdrop-blur-md border-b border-coffee/20">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-brown focus:text-paper focus:px-4 focus:py-2 focus:rounded-lg focus:font-hero focus:text-xs focus:tracking-[0.22em] focus:uppercase">Skip to content</a>
      <nav className={cls.container + " flex items-center justify-between py-4 gap-2"} aria-label="Primary">
        <a href="/" className="flex items-baseline gap-2 touch-min flex-shrink-0">
          <span className="font-hero text-xl text-brown tracking-tight">PetView</span>
          <span className="font-hero text-[10px] tracking-[0.28em] uppercase text-accent">by SoliVana</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-3 flex-nowrap justify-end">
          {signedIn && (
            <button onClick={onAccount} aria-label={`Account · ${email}`} className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-paper border border-coffee/30 text-xs hover:border-accent/50 transition-colors touch-min">
              <span className="font-heading font-medium text-accent tabular-nums">{hasUnlimited ? "∞" : credits}</span>
              <span className="text-coffeeText">{hasUnlimited ? "Unlimited" : credits === 1 ? "scan left" : "scans"}</span>
              <span className="text-coffeeText/40">·</span>
              <span className="text-coffeeText truncate max-w-[160px]">{email}</span>
            </button>
          )}
          {signedIn && (
            <button onClick={onAccount} aria-label="Account" className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper border border-coffee/30 text-xs touch-min">
              <span className="font-heading font-medium text-accent tabular-nums">{hasUnlimited ? "∞" : credits}</span>
            </button>
          )}
          {!signedIn && onSignin && (
            <button onClick={onSignin} className="hidden sm:inline font-hero text-xs tracking-[0.22em] uppercase text-coffeeText hover:text-brown transition-colors touch-min px-3">Sign in</button>
          )}
          <button onClick={onAbout} className="font-hero text-xs tracking-[0.22em] uppercase text-coffeeText hover:text-brown transition-colors touch-min px-3 hidden sm:inline">About</button>
          {onScience && (
            <button onClick={onScience} className="font-hero text-xs tracking-[0.22em] uppercase text-coffeeText hover:text-brown transition-colors touch-min px-3 hidden sm:inline">Science</button>
          )}
          <button onClick={onScan} className={cls.btnPrimary + " !px-4 !py-2.5 text-xs whitespace-nowrap"}><span className="sm:hidden">Scan</span><span className="hidden sm:inline">Scan a pet</span></button>
          {signedIn && <SettingsDropdown signedIn={signedIn} email={email} onAccount={onAccount} onSignOut={onSignOut} onAdmin={onAdmin} />}
        </div>
      </nav>
    </header>
  );
}

function VetBanner() {
  return (
    <div className="bg-coffeeLight border-b border-coffee/30" role="region" aria-label="Veterinary disclaimer">
      <div className={cls.container + " py-2.5 flex items-start gap-2 text-xs text-brown"}>
        <I.Alert c="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
        <p className="font-body">{VET_DISCLAIMER}</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-paper border-t border-coffee/20 mt-16">
      <div className={cls.container + " py-10"}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="font-hero text-lg text-brown tracking-tight">PetView <span className="text-accent text-xs tracking-[0.3em] uppercase ml-2">by SoliVana</span></p>
            <p className={cls.body + " text-sm mt-2"}>A gentle photo-based check for the pets we love.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
            {[
              { label: "SoliVana", href: "https://solivana.com" },
              { label: "Privacy", href: "https://tools.solivana.io/privacy" },
              { label: "Terms", href: "https://tools.solivana.io/terms" },
              { label: "Refund", href: "https://tools.solivana.io/refund" },
              { label: "AI Disclosure", href: "https://tools.solivana.io/privacy#ai" },
            ].map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="font-hero text-xs tracking-[0.22em] uppercase text-brown hover:text-accent transition-colors">{l.label}</a>
            ))}
            <a href="mailto:info@solivana.com" className="font-hero text-xs tracking-[0.22em] uppercase text-brown hover:text-accent transition-colors">Support</a>
          </div>
        </div>
        <a
          href="https://innerview.solivana.io"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 block rounded-2xl border border-coffee/20 bg-soft px-5 py-4 hover-lift group"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-hero text-[10px] tracking-[0.22em] uppercase text-accent mb-1">For the people who love them</p>
              <p className="font-heading text-sm text-brown">
                We also read human faces. <span className="text-coffeeText font-normal">InnerView reads stress, vitality, and what your own face may be communicating — through the same traditional frameworks.</span>
              </p>
            </div>
            <span className="font-hero text-[10px] tracking-[0.22em] uppercase text-accent group-hover:translate-x-0.5 transition-transform whitespace-nowrap">Try InnerView →</span>
          </div>
        </a>
        <div className="mt-8 pt-6 border-t border-coffee/20">
          <p className={cls.body + " text-xs"}>{VET_DISCLAIMER}</p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  HOME / LANDING                                              */
/* ═══════════════════════════════════════════════════════════ */
function Home({ onInnerView, onPetView, onAbout, onScience, onSignin, onAccount, onSignOut, onAdmin }: { onInnerView: () => void; onPetView: () => void; onAbout: () => void; onScience: () => void; onSignin: () => void; onAccount: () => void; onSignOut?: () => void; onAdmin?: () => void }) {
  const links = trpc.access.paymentLinks.useQuery();
  const goStarter = links.data?.starter ? () => window.open(links.data!.starter, "_blank") : undefined;
  const goUnlimited = links.data?.unlimited ? () => window.open(links.data!.unlimited, "_blank") : undefined;
  const goUnlimitedAnnual = links.data?.unlimitedAnnual ? () => window.open(links.data!.unlimitedAnnual, "_blank") : undefined;
  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout} onScan={onInnerView} onSignin={onSignin} onAccount={onAccount} onSignOut={onSignOut} onScience={onScience} onAdmin={onAdmin} />
      <VetBanner />
      <main id="main" tabIndex={-1}>
        {/* HERO */}
        <section className={cls.container + " py-10 lg:py-14"}>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            <div className="lg:col-span-7 order-2 lg:order-1 animate-fade-up">
              <p className={cls.labelAccent + " mb-4"}>Emotional View · AI reads what photos reveal.</p>
              <h1 className={cls.h1 + " text-4xl sm:text-5xl lg:text-6xl mb-6"}>
                See what your pet's<br />
                <span className="text-accent">face is telling you.</span>
              </h1>
              <div className="font-body text-lg lg:text-xl text-coffeeText leading-relaxed max-w-2xl mb-8 space-y-4">
                <p>
                  Take four close-up photos and receive two readings grounded in peer-reviewed
                  science — the Feline Grimace Scale, DogFACS, and veterinary AI research.
                </p>
                <p>
                  <strong className="text-brown">Emotional View</strong> reads the emotional
                  layer — stress, pain signals, and mood cues visible in facial expression.
                </p>
                <p>
                  <strong className="text-brown">Physical Wellness Observation</strong> reads
                  the body — nose, eyes, ears, and mouth through traditional wellness frameworks.
                </p>
                <p className="font-heading text-brown text-base lg:text-lg">
                  We don't diagnose. We translate.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-xs font-hero tracking-[0.22em] uppercase text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden /> Two free scans on us
              </div>
              <div className="flex flex-wrap gap-3 mb-6">
                <button onClick={onInnerView} className={cls.btnPrimary + " text-base !px-8 !py-4"}>
                  <I.Paw /> Try Emotional View
                </button>
                <button onClick={onPetView} className={cls.btnPrimary + " text-base !px-8 !py-4"}>
                  <I.Paw /> Try Wellness Scan
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mb-5">
                <div className="text-left rounded-2xl border border-coffee/20 bg-paper px-5 py-5 shadow-sm">
                  <p className="font-heading text-2xl text-brown leading-none">Free</p>
                  <p className="font-hero text-[11px] tracking-[0.22em] uppercase text-coffeeText mt-3">1 Emotional View + 1 Wellness Scan</p>
                  <p className="text-xs text-brown/60 mt-2 leading-relaxed">Two free per device. Try both.</p>
                  <div className="mt-4 pt-4 border-t border-coffee/10 space-y-2">
                    <p className="text-xs text-coffeeText flex items-center gap-2"><I.Check c="w-3 h-3 text-accent" /> 1 photo emotional</p>
                    <p className="text-xs text-coffeeText flex items-center gap-2"><I.Check c="w-3 h-3 text-accent" /> 4 photo wellness scan</p>
                  </div>
                </div>
                <button onClick={goStarter} disabled={!goStarter} className="text-left rounded-2xl border border-coffee/20 bg-paper px-5 py-5 hover-lift shadow-sm cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed">
                  <p className="font-heading text-2xl text-brown leading-none">$9.99</p>
                  <p className="font-hero text-[11px] tracking-[0.22em] uppercase text-coffeeText mt-3">5 scans</p>
                  <p className="text-xs text-brown/60 mt-2 leading-relaxed">One-time, never expires. Emotional View included.</p>
                  <div className="mt-4 pt-4 border-t border-coffee/10 space-y-2">
                    <p className="text-xs text-coffeeText flex items-center gap-2"><I.Check c="w-3 h-3 text-accent" /> 5 scans</p>
                    <p className="text-xs text-coffeeText flex items-center gap-2"><I.Check c="w-3 h-3 text-accent" /> Emotional View every scan</p>
                  </div>
                </button>
                <button onClick={goUnlimited} disabled={!goUnlimited} className="text-left rounded-2xl bg-brown px-5 py-5 relative hover-lift shadow-[0_8px_32px_-12px_rgba(51,29,1,0.35)] cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed">
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 font-hero text-[9px] tracking-[0.22em] uppercase text-brown bg-accent px-3 py-1 rounded-full whitespace-nowrap">Most loved</span>
                  <p className="font-heading text-2xl text-accent leading-none">$19.99<span className="text-sm text-coffeeLight font-body font-normal">/mo</span></p>
                  <p className="font-hero text-[11px] tracking-[0.22em] uppercase text-accent/80 mt-3">Monthly Unlimited</p>
                  <p className="text-xs text-coffeeLight/70 mt-2 leading-relaxed">Pause or cancel anytime.</p>
                  <div className="mt-4 pt-4 border-t border-coffee/20 space-y-2">
                    <p className="text-xs text-coffeeLight flex items-center gap-2"><I.Check c="w-3 h-3 text-accent" /> Unlimited scans</p>
                    <p className="text-xs text-coffeeLight flex items-center gap-2"><I.Check c="w-3 h-3 text-accent" /> Emotional View every scan</p>
                  </div>
                </button>
                <button onClick={goUnlimitedAnnual} disabled={!goUnlimitedAnnual} className="text-left rounded-2xl border border-coffee/20 bg-paper px-5 py-5 hover-lift shadow-sm cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed">
                  <p className="font-heading text-2xl text-brown leading-none">$199<span className="text-sm text-coffeeText font-body font-normal">/yr</span></p>
                  <p className="font-hero text-[11px] tracking-[0.22em] uppercase text-coffeeText mt-3">Annual Unlimited</p>
                  <p className="text-xs text-brown/60 mt-2 leading-relaxed">2 months free vs monthly.</p>
                  <div className="mt-4 pt-4 border-t border-coffee/10 space-y-2">
                    <p className="text-xs text-coffeeText flex items-center gap-2"><I.Check c="w-3 h-3 text-accent" /> Unlimited all year</p>
                    <p className="text-xs text-coffeeText flex items-center gap-2"><I.Check c="w-3 h-3 text-accent" /> Emotional View every scan</p>
                  </div>
                </button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {[
                  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, text: "Cancel or pause anytime" },
                  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, text: "About 30 seconds" },
                  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>, text: "Photos not stored" },
                ].map((item) => (
                  <span key={item.text} className="inline-flex items-center gap-2 text-[11px] font-hero tracking-[0.18em] uppercase text-brown">
                    <span className="text-accent">{item.icon}</span>{item.text}
                  </span>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 order-1 lg:order-2 animate-fade-up" style={{ animationDelay: '0.15s' }}>
              <div className="relative">
                {/* Decorative ambient orbs */}
                <div className="absolute -top-8 -right-6 w-40 h-40 rounded-full bg-accent/10 blur-3xl -z-10" aria-hidden />
                <div className="absolute -bottom-4 -left-6 w-48 h-48 rounded-full bg-accent/8 blur-3xl -z-10" aria-hidden />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-coffee/5 blur-2xl -z-10" aria-hidden />

                <div className="grid grid-cols-2 gap-4 items-start">
                  {/* Dog photo — left, slightly larger */}
                  <div className="relative rounded-3xl overflow-hidden border border-coffee/20 bg-paper shadow-[0_8px_32px_-12px_rgba(51,29,1,0.18)] group">
                    <img src={PET_IMG.heroDog} alt="A golden retriever ready for a photo scan" className="w-full aspect-[3/4] object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-brown/25 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-sm text-[10px] font-hero tracking-[0.2em] uppercase text-brown">
                        <span className="w-1 h-1 rounded-full bg-accent" /> Dogs
                      </span>
                    </div>
                  </div>
                  {/* Cat photo — right, offset down for visual rhythm */}
                  <div className="relative rounded-3xl overflow-hidden border border-coffee/20 bg-paper shadow-[0_8px_32px_-12px_rgba(51,29,1,0.18)] mt-6 group">
                    <img src={PET_IMG.heroCat} alt="A relaxed cat ready for a photo" className="w-full aspect-[3/4] object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-brown/25 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 backdrop-blur-sm text-[10px] font-hero tracking-[0.2em] uppercase text-brown">
                        <span className="w-1 h-1 rounded-full bg-accent" /> Cats
                      </span>
                    </div>
                  </div>
                </div>

                {/* Research cred card */}
                <div className="mt-5 bg-paper border border-coffee/20 rounded-2xl px-5 py-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#EC9247" strokeWidth={1.5} className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div>
                      <p className="font-hero text-[10px] tracking-[0.28em] uppercase text-accent mb-0.5">Grounded in peer-reviewed science</p>
                      <p className="font-heading text-sm text-brown leading-snug">Built on the Feline Grimace Scale, DogFACS, and veterinary AI research from Scientific Reports, Frontiers, and Nature.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TWO WAYS TO SCAN */}
        <section className={cls.container + " py-8 lg:py-10"}>
          <div className="text-center mb-10">
            <p className={cls.labelAccent + " mb-3"}>Two ways to scan</p>
            <h2 className={cls.h2 + " text-3xl lg:text-4xl max-w-2xl mx-auto"}>Start with Emotional View. Go deeper with the Wellness Scan.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Emotional View — 1 photo */}
            <div className="bg-brown border border-coffee/30 rounded-2xl p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="flex items-center gap-2 mb-5">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center relative">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#EC9247" strokeWidth={1.5} className="w-6 h-6"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </div>
                <span className="font-hero text-[10px] tracking-[0.22em] uppercase text-accent px-2.5 py-1 bg-accent/15 rounded-full">Try this first</span>
              </div>
              <h3 className={cls.h2 + " text-xl mb-2 text-paper relative"}>Emotional <span className="text-accent">View</span></h3>
              <p className={cls.body + " text-sm mb-6 flex-1 text-coffeeLight relative"}>One photo. An emotional wellness reading through TCM, Ayurveda, and bioenergetics. Stress signals, pain cues, mood, and what your pet may be communicating beneath the surface. The gentlest way to begin.</p>
              <div className="flex flex-wrap gap-2 relative mb-6">
                {["1 photo","30 seconds","Free"].map(a => (
                  <span key={a} className="text-[11px] font-hero tracking-wider uppercase px-2.5 py-1 bg-accent/15 text-accent rounded-full">{a}</span>
                ))}
              </div>
              <button onClick={onInnerView} className={cls.btnPrimary + " w-full relative"}>
                <I.Paw /> Emotional View
              </button>
            </div>
            {/* PetView — 4 photos */}
            <div className="bg-paper border border-coffee/30 rounded-2xl p-8 flex flex-col">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#EC9247" strokeWidth={1.5} className="w-6 h-6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                </div>
                <span className="font-hero text-[10px] tracking-[0.22em] uppercase text-brown px-2.5 py-1 bg-accent/10 rounded-full">Wellness Scan</span>
              </div>
              <h3 className={cls.h2 + " text-xl mb-2"}>Wellness <span className="text-accent">Scan</span></h3>
              <p className={cls.body + " text-sm mb-6 flex-1"}>Four targeted photos — nose, eyes, ears, and mouth. Physical wellness observation through FGS and DogFACS, plus the full Emotional View layer. The complete picture.</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["4 photos","Physical + Emotional","Vet-grade"].map(a => (
                  <span key={a} className="text-[11px] font-hero tracking-wider uppercase px-2.5 py-1 bg-accent/10 text-accent rounded-full">{a}</span>
                ))}
              </div>
              <button onClick={onPetView} className={cls.btnSecondary + " w-full"}>
                Wellness Scan <I.ArrowR />
              </button>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <ScrollReveal className={cls.container + " py-20"}>
          <p className={cls.labelAccent + " mb-3"}>How it works</p>
          <h2 className={cls.h2 + " text-4xl lg:text-5xl mb-12 max-w-3xl"}>Three quiet steps.</h2>
          <ol className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              { n: "01", title: "Capture", desc: "Four close-up photos, one for each area. We'll guide you through each." },
              { n: "02", title: "Observe", desc: "All four photos are read together — about twenty seconds." },
              { n: "03", title: "Receive", desc: "Plain-English notes per area, things to watch for, and signs that warrant a vet visit." },
            ].map((s) => (
              <li key={s.n} className="bg-paper border border-coffee/30 rounded-2xl p-8 hover-lift">
                <p className="font-hero text-5xl text-accent/40 leading-none mb-4">{s.n}</p>
                <h3 className="font-heading text-xl text-brown mb-2">{s.title}</h3>
                <p className={cls.body}>{s.desc}</p>
              </li>
            ))}
          </ol>
        </ScrollReveal>

        {/* FOUR AREAS */}
        <section className="bg-paper border-y border-coffee/20">
          <ScrollReveal className={cls.container + " py-20"}>
            <p className={cls.labelAccent + " mb-3"}>The four-photo scan</p>
            <h2 className={cls.h2 + " text-4xl lg:text-5xl mb-6 max-w-3xl"}>
              Four areas vets look at first.<br />
              <span className="text-accent">All in one careful read.</span>
            </h2>
            <p className="font-body text-lg text-coffeeText max-w-3xl mb-12">Each photo focuses on one anatomical area. We read all four together so we can describe each on its own and notice patterns across them.</p>

            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              {AREAS.map((a) => (
                <article key={a.id} className="bg-soft border border-coffee/30 rounded-2xl overflow-hidden flex flex-col hover-lift">
                  <div className="aspect-[16/10] overflow-hidden">
                    <img src={a.guideImg} alt={`Reference photo of a pet's ${a.label.toLowerCase()}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <p className={cls.labelAccent + " mb-2"}>{a.short}</p>
                    <h3 className="font-heading text-2xl text-brown mb-3">{a.label}</h3>
                    <p className={cls.body + " mb-5 text-sm flex-1"}>{a.about}</p>
                    <ul className="space-y-1.5">
                      {a.whatWeRead.map((w) => (
                        <li key={w} className="flex items-start gap-2 text-sm text-brown">
                          <I.Check c="w-3.5 h-3.5 mt-1 text-accent flex-shrink-0" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </ScrollReveal>
        </section>

        {/* WHAT THIS IS / ISN'T */}
        <section className="bg-paper border-y border-coffee/20">
          <div className={cls.container + " py-20"}>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <p className={cls.labelAccent + " mb-3"}>What this is — and isn't</p>
                <h2 className={cls.h2 + " text-3xl lg:text-4xl mb-6"}>Worth a look. Never a verdict.</h2>
                <div className="space-y-4 font-body text-coffeeText">
                  <p>PetView gives you a careful, AI-generated reading of what's visible in your photos. Our observations are informed by peer-reviewed veterinary research — including the Feline Grimace Scale, DogFACS, and validated pain-assessment frameworks used in clinics worldwide.</p>
                  <p>What we don't do: diagnose conditions, prescribe anything, or replace your vet. If something looks off in your reading, the next step is always to call your veterinarian and share the photos with them.</p>
                </div>
              </div>
              <aside>
                <div className="bg-coffeeLight rounded-2xl p-6">
                  <p className={cls.labelAccent + " mb-3"}>If urgent</p>
                  <p className={cls.body + " text-sm mb-4"}>If your pet is in distress — labored breathing, collapse, severe bleeding, signs of poisoning — don't wait for a photo reading.</p>
                  <a href="https://www.aspca.org/pet-care/animal-poison-control" target="_blank" rel="noopener noreferrer" className={cls.btnGhost}>ASPCA poison control <I.ArrowR /></a>
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* RESCUE & FOSTER SPONSORSHIP */}
        <section className="bg-soft">
          <div className={cls.container + " py-20"}>
            <div className="grid md:grid-cols-5 gap-8 items-center">
              <div className="md:col-span-3">
                <p className={cls.labelAccent + " mb-3"}>Rescue & Foster</p>
                <h2 className={cls.h2 + " text-3xl lg:text-4xl mb-5"}>If you care for animals who've already been through enough — this one's on me.</h2>
                <div className="space-y-4 font-body text-coffeeText">
                  <p>If you work with a rescue organization or foster animals, reach out directly. I will sponsor it.</p>
                  <p>Rescue volunteers and nonprofit shelters get unlimited access, on me. These animals have already been through enough. The people caring for them shouldn't have to guess.</p>
                  <p className="text-sm text-coffeeText/80">— Natasha Berness, Co-Founder of SoliVana Wellness</p>
                </div>
                <div className="mt-7">
                  <a
                    href={`mailto:info@solivana.com?subject=${encodeURIComponent("PetView Rescue Sponsorship")}&body=${encodeURIComponent(
                      "Hi Natasha,\n\nI'd like to apply for PetView rescue sponsorship.\n\n" +
                      "Organization name:\nEIN / tax ID:\nMy name + role:\nWebsite or social:\nApprox. animals cared for / year:\nA few sentences about what we do:\n\n" +
                      "Best email to send the access code to:\nThanks for what you do.\n"
                    )}`}
                    className={cls.btnPrimary + " text-base !px-7 !py-3.5"}
                  >
                    <I.Paw /> Apply for sponsorship
                  </a>
                  <p className="text-xs font-hero tracking-[0.18em] uppercase text-coffeeText mt-4">Response within 48 hours</p>
                </div>
              </div>
              <aside className="md:col-span-2 bg-paper border border-coffee/30 rounded-2xl p-6">
                <p className={cls.labelAccent + " mb-3"}>What we'll need</p>
                <ul className={cls.body + " text-sm space-y-2"}>
                  <li><strong className="text-brown">Organization name</strong> and EIN / tax ID (for our donation records)</li>
                  <li><strong className="text-brown">Your role</strong> at the rescue or as a foster</li>
                  <li><strong className="text-brown">Website or social</strong> we can verify</li>
                  <li><strong className="text-brown">The email</strong> we should send your access code to</li>
                </ul>
                <p className={cls.body + " text-xs mt-4 text-coffeeText"}>You'll receive a code that unlocks 100 scans on this account. Renewable annually with a quick check-in.</p>
              </aside>
            </div>
          </div>
        </section>

        {/* CLOSING */}
        <section className="bg-paper border-y border-coffee/20">
          <ScrollReveal className={cls.container + " py-20 text-center"}>
            <p className={cls.labelAccent + " mb-3"}>Ready when you are</p>
            <h2 className={cls.h2 + " text-4xl lg:text-5xl mb-6"}>Four photos.<br/><span className="text-accent">A careful, science-informed read.</span></h2>
            <p className="font-body text-lg text-coffeeText max-w-2xl mx-auto mb-8">Have a treat handy. Find good light. We'll guide the rest — and show you what the research sees.</p>
            <button onClick={onInnerView} className={cls.btnPrimary + " text-base !px-8 !py-4"}>
              <I.Paw /> Begin a scan
            </button>
          </ScrollReveal>
        </section>

        {/* TRUST & SECURITY */}
        <ScrollReveal className={cls.container + " py-12"}>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-70">
            <div className="flex items-center gap-2 text-sm text-coffeeText font-hero tracking-wider uppercase">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Bank-level encryption
            </div>
            <div className="flex items-center gap-2 text-sm text-coffeeText font-hero tracking-wider uppercase">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Stripe secured payments
            </div>
            <div className="flex items-center gap-2 text-sm text-coffeeText font-hero tracking-wider uppercase">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Photos not stored
            </div>
            <div className="flex items-center gap-2 text-sm text-coffeeText font-hero tracking-wider uppercase">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Peer-reviewed science
            </div>
          </div>
        </ScrollReveal>
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  PHOTO TIPS                                                  */
/* ═══════════════════════════════════════════════════════════ */
function TipsScreen({ onContinue, onClose, onAbout, onInnerView, onSignOut }: { onContinue: (petName: string) => void; onClose: () => void; onAbout?: () => void; onInnerView?: () => void; onSignOut?: () => void }) {
  const [petName, setPetName] = useState("");
  const tips = [
    { icon: <I.Sun />,    title: "Natural light",           desc: "Outside or near a bright window. Avoid harsh overhead light and direct sun in the eyes." },
    { icon: <I.Frame />,  title: "Fill the frame",          desc: "Get the area front and center. Phone about a foot away works for most pets." },
    { icon: <I.Treat />,  title: "Use a treat",             desc: "Hold a treat just behind the camera. Most pets will look right at the lens for a beat." },
    { icon: <I.Steady />, title: "Steady hand",             desc: "Hold the phone with both hands. A blurry photo is the most common reason we can't read clearly." },
    { icon: <I.NoFlash />,title: "No filters or flash",     desc: "Filters distort color (and gum/conjunctiva color is a key cue). Flash will spook most pets." },
    { icon: <I.Camera />, title: "Burst, then pick the best", desc: "Use burst mode if your pet won't sit still. You can pick the sharpest one before submitting." },
  ];
  const pillars = [
    { icon: "💜", title: "Emotional Layer", desc: "Emotional View reads subtle energetic patterns through TCM, Ayurveda, and bioenergetics — what your pet may be communicating beneath the surface." },
    { icon: "🌿", title: "Physical Patterns", desc: "We observe nose, eyes, ears, and mouth through traditional wellness frameworks, not just symptom checklists." },
    { icon: "✨", title: "Two Readings, One Scan", desc: "No other app combines emotional insight with physical observation. Both layers appear in every result." },
  ];
  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout ?? (() => {})} onScan={() => onContinue(petName)} onSignOut={onSignOut} />
      <VetBanner />
      <main id="main" tabIndex={-1} className={cls.container + " py-12 lg:py-20"}>
        {onInnerView && <ScanModeSwitcher active="full" onInnerView={onInnerView} onFullScan={() => {}} />}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className={cls.labelAccent}>Before you scan</p>
            <h1 className={cls.h1 + " text-4xl lg:text-5xl mt-2"}>Six tips for a clear read.</h1>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-coffeeText hover:text-brown touch-min p-2"><I.Close c="w-6 h-6" /></button>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 mb-10">
          <div className="lg:col-span-7">
            <div className="bg-paper border border-coffee/30 rounded-2xl p-6 mb-6">
              <label className={cls.labelAccent + " mb-2 block"}>Your pet's name</label>
              <input
                type="text"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="e.g. Luna"
                className="w-full px-4 py-3 rounded-xl border border-coffee/30 bg-soft font-heading text-brown placeholder:text-coffeeText/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="text-xs text-coffeeText mt-2">Optional — we'll personalize your reading.</p>
            </div>
            <ol className="grid sm:grid-cols-2 gap-4">
              {tips.map((t, i) => (
                <li key={i} className="bg-paper border border-coffee/30 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">{t.icon}</div>
                    <div>
                      <h2 className="font-heading font-medium text-brown mb-1">{t.title}</h2>
                      <p className={cls.body + " text-sm"}>{t.desc}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <aside className="lg:col-span-5">
            <div className="bg-paper border border-coffee/30 rounded-2xl overflow-hidden mb-5">
              <div className="aspect-[4/3] overflow-hidden bg-coffeeLight">
                <img src={PET_IMG.tipComparison} alt="Side-by-side: a clear, in-focus pet photo next to a blurry, dim one" className="w-full h-full object-cover" />
              </div>
              <div className="p-5">
                <p className={cls.labelAccent + " mb-2"}>Side by side</p>
                <p className={cls.body + " text-sm"}>The photo on the left is what we can read well. The right one is what trips us up — too dark, too far, or out of focus.</p>
              </div>
            </div>
            <div className="bg-paper border border-coffee/30 rounded-2xl p-5">
              <p className={cls.labelAccent + " mb-3"}>Why Emotional View</p>
              <div className="space-y-3">
                {pillars.map((p, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{p.icon}</span>
                    <div>
                      <h3 className="font-heading text-sm font-medium text-brown">{p.title}</h3>
                      <p className={cls.body + " text-xs"}>{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap gap-3 mt-12">
          <button onClick={() => onContinue(petName)} className={cls.btnPrimary + " text-base !px-8 !py-4"}><I.Camera /> I'm ready</button>
          <button onClick={onClose} className={cls.btnSecondary + " text-base !px-8 !py-4"}>Back</button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  CAPTURE — 4-photo flow with consent gate                   */
/* ═══════════════════════════════════════════════════════════ */
type PhotoMap = Partial<Record<ScanArea, string>>;

function CaptureScreen({ onSubmit, onClose, onAbout, petName, onSignOut }: { onSubmit: (photos: PhotoMap, species: Species) => void; onClose: () => void; onAbout?: () => void; petName?: string; onSignOut?: () => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [species, setSpecies] = useState<Species>("dog");
  const [error, setError] = useState<string | null>(null);
  const [consentAi, setConsentAi] = useState(false);
  const [consentNoHumans, setConsentNoHumans] = useState(false);
  const [consentAge, setConsentAge] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const allConsented = consentAi && consentNoHumans && consentAge;
  const currentArea = AREAS[stepIdx];
  const totalSteps = AREAS.length;

  const checkBlur = useCallback(async (dataUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cvs = document.createElement("canvas");
        cvs.width = 100;
        cvs.height = 100;
        const ctx = cvs.getContext("2d");
        if (!ctx) { resolve(false); return; }
        ctx.drawImage(img, 0, 0, 100, 100);
        try {
          const data = ctx.getImageData(0, 0, 100, 100).data;
          let grayscale = [];
          for (let i = 0; i < data.length; i += 4) {
            grayscale.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          }
          let sum = 0, sumSq = 0;
          for (let y = 1; y < 99; y++) {
            for (let x = 1; x < 99; x++) {
              const idx = y * 100 + x;
              const laplacian = Math.abs(
                -4 * grayscale[idx] +
                grayscale[idx - 1] + grayscale[idx + 1] +
                grayscale[idx - 100] + grayscale[idx + 100]
              );
              sum += laplacian;
              sumSq += laplacian * laplacian;
            }
          }
          const variance = sumSq / (98 * 98) - (sum / (98 * 98)) ** 2;
          resolve(variance < 80);
        } catch { resolve(false); }
      };
      img.onerror = () => resolve(false);
      img.src = dataUrl;
    });
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!/^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      playChime("error");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("Image is huge. Try a smaller photo (under 25MB).");
      playChime("error");
      return;
    }
    try {
      const processed = await preprocessFile(file, { maxLongEdge: 1280, quality: 0.85 });
      const isBlurry = await checkBlur(processed);
      if (isBlurry) {
        setError("This photo looks blurry — try holding steadier or using burst mode.");
        playChime("error");
      }
      setPhotos((prev) => ({ ...prev, [currentArea!.id]: processed }));
      playChime("capture");
      triggerHaptic();
    } catch (e) {
      setError("We couldn't read that file. Please try another.");
      playChime("error");
    }
  }, [currentArea, checkBlur]);

  const next = () => {
    setError(null);
    if (stepIdx < totalSteps - 1) setStepIdx(stepIdx + 1);
    else setShowReview(true);
  };
  const prev = () => {
    setError(null);
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  };
  const skip = () => next();
  const retake = (areaId: ScanArea) => {
    setPhotos((prev) => { const { [areaId]: _, ...rest } = prev; return rest; });
    const idx = AREAS.findIndex((a) => a.id === areaId);
    if (idx >= 0) { setStepIdx(idx); setShowReview(false); }
  };

  const collectedCount = Object.keys(photos).length;
  const currentPhoto = photos[currentArea!.id];

  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout ?? (() => {})} onScan={() => {}} onSignOut={onSignOut} />
      <VetBanner />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} className="hidden" />

      <main id="main" tabIndex={-1} className={cls.container + " py-12 lg:py-16"}>
        {/* PROGRESS */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className={cls.labelAccent}>{showReview ? "Review" : `Photo ${stepIdx + 1} of ${totalSteps}`}</p>
            <h1 className={cls.h1 + " text-3xl lg:text-4xl mt-2"}>{showReview ? "All set?" : currentArea!.label}</h1>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-coffeeText hover:text-brown touch-min p-2"><I.Close c="w-6 h-6" /></button>
        </div>

        <div className="flex gap-2 mb-10" role="progressbar" aria-valuenow={stepIdx + 1} aria-valuemin={1} aria-valuemax={totalSteps} aria-label="Capture progress">
          {AREAS.map((a, i) => (
            <div key={a.id} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${photos[a.id] ? "bg-accent" : i === stepIdx && !showReview ? "bg-brown/30" : "bg-coffee/30"}`} />
              <p className={`text-xs mt-2 font-hero tracking-wider uppercase ${i === stepIdx && !showReview ? "text-brown" : photos[a.id] ? "text-accent" : "text-coffeeText"}`}>{a.label}</p>
            </div>
          ))}
        </div>

        {/* ═══ CAPTURE STEP ═══ */}
        {!showReview && currentArea && (
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <div className="bg-paper border border-coffee/30 rounded-2xl overflow-hidden mb-5">
                <div className="relative w-full aspect-[4/3]">
                  {currentPhoto ? (
                    <img src={currentPhoto} alt={`Your photo of the ${currentArea.label.toLowerCase()}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-coffeeLight flex items-center justify-center overflow-hidden">
                      <img src={currentArea.scanImg} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-30" />
                      <div className="relative text-center px-6">
                        <div className="w-16 h-16 rounded-full bg-accent/15 backdrop-blur flex items-center justify-center mx-auto mb-3"><I.Camera c="w-7 h-7 text-accent" /></div>
                        <p className="font-heading text-lg text-brown">Take a photo of the {currentArea.label.toLowerCase()}</p>
                        <p className={cls.body + " text-sm mt-1"}>{currentArea.short}</p>
                        <p className="text-xs font-hero tracking-[0.22em] uppercase text-accent mt-3">Fill the frame</p>
                        {petName && <p className="text-xs text-coffeeText mt-1 font-body">For {petName}</p>}
                      </div>
                    </div>
                  )}
                  {/* Framing overlay — corner brackets + center guide. Always
                      visible (over both empty state and the captured image)
                      so users can verify framing before continuing. */}
                  <div aria-hidden className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-3 left-3 w-7 h-7 border-t-2 border-l-2 border-accent rounded-tl-lg" />
                    <div className="absolute top-3 right-3 w-7 h-7 border-t-2 border-r-2 border-accent rounded-tr-lg" />
                    <div className="absolute bottom-3 left-3 w-7 h-7 border-b-2 border-l-2 border-accent rounded-bl-lg" />
                    <div className="absolute bottom-3 right-3 w-7 h-7 border-b-2 border-r-2 border-accent rounded-br-lg" />
                    {!currentPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2/3 h-2/3 border border-dashed border-accent/40 rounded-2xl" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 bg-destructive/5 border border-destructive/30 text-destructive rounded-xl p-3 mb-5">
                  <I.Alert c="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-body">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => isMobile ? cameraRef.current?.click() : galleryRef.current?.click()} className={cls.btnSecondary + " w-full !py-4 flex-col gap-2"}>
                  <I.Camera c="w-5 h-5" /> <span>{isMobile ? "Camera" : "Upload photo"}</span>
                </button>
                <button onClick={() => galleryRef.current?.click()} className={cls.btnSecondary + " w-full !py-4 flex-col gap-2"}>
                  <I.Image c="w-5 h-5" /> <span>Gallery</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
                <button onClick={prev} disabled={stepIdx === 0} className={cls.btnGhost + " disabled:opacity-30 disabled:cursor-not-allowed"}>
                  <I.ArrowL /> Previous
                </button>
                <div className="flex gap-3 ml-auto">
                  <button onClick={skip} className="font-hero text-xs tracking-[0.22em] uppercase text-coffeeText hover:text-brown transition-colors touch-min px-3">Skip this</button>
                  <button onClick={next} className={cls.btnPrimary}>
                    {stepIdx < totalSteps - 1 ? "Next photo" : "Review"} <I.ArrowR />
                  </button>
                </div>
              </div>
            </div>

            <aside className="lg:col-span-5">
              {/* AREA GUIDANCE CARD */}
              <div className="bg-paper border border-coffee/30 rounded-2xl overflow-hidden mb-5">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={currentArea.tipImg} alt={`Framing example for the ${currentArea.label.toLowerCase()} photo`} className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <p className={cls.labelAccent + " mb-2"}>Framing</p>
                  <h3 className="font-heading text-lg text-brown mb-2">For the {currentArea.label.toLowerCase()}</h3>
                  <p className={cls.body + " text-sm mb-3"}>{currentArea.about}</p>
                  <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 mb-3">
                    <p className="text-xs font-hero tracking-wider uppercase text-accent mb-1">Traditional wellness lens</p>
                    <p className="text-sm text-brown font-body">{currentArea.tcmNote}</p>
                  </div>
                  <ul className="space-y-1.5">
                    {currentArea.whatWeRead.map((w) => (
                      <li key={w} className="flex items-start gap-2 text-sm text-brown">
                        <I.Check c="w-3.5 h-3.5 mt-1 text-accent flex-shrink-0" />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ═══ REVIEW + CONSENT ═══ */}
        {showReview && (
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <p className={cls.labelAccent + " mb-3"}>Your photos</p>
              <h2 className={cls.h2 + " text-2xl mb-5"}>You captured {collectedCount} of {totalSteps}.</h2>
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {AREAS.map((a) => (
                  <div key={a.id} className="bg-paper border border-coffee/30 rounded-2xl overflow-hidden">
                    <div className="aspect-[4/3] bg-coffeeLight overflow-hidden">
                      {photos[a.id] ? (
                        <img src={photos[a.id]} alt={`Your ${a.label.toLowerCase()} photo`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-coffeeText">
                          <span className="text-xs font-hero tracking-wider uppercase">Skipped</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <p className="font-heading text-sm text-brown">{a.label}</p>
                      <button onClick={() => retake(a.id)} className="text-xs text-accent hover:text-brown font-hero tracking-wider uppercase">{photos[a.id] ? "Retake" : "Add"}</button>
                    </div>
                  </div>
                ))}
              </div>
              {collectedCount === 0 && (
                <div role="alert" className="flex items-start gap-2 bg-destructive/5 border border-destructive/30 text-destructive rounded-xl p-3 mb-5">
                  <I.Alert c="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-body">Add at least one photo before submitting.</p>
                </div>
              )}
              <button onClick={() => setShowReview(false)} className={cls.btnSecondary}>
                <I.ArrowL /> Back to capture
              </button>
            </div>

            <aside className="lg:col-span-5">
              <fieldset className="mb-6">
                <legend className={cls.labelAccent + " mb-3"}>Pet</legend>
                <div
                  role="radiogroup"
                  aria-label="Pet species"
                  className="grid grid-cols-2 gap-2"
                  onKeyDown={(e) => {
                    const opts: Species[] = ["dog", "cat"];
                    const idx = opts.indexOf(species);
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setSpecies(opts[(idx + 1) % opts.length]!); }
                    if (e.key === "ArrowLeft" || e.key === "ArrowUp")    { e.preventDefault(); setSpecies(opts[(idx - 1 + opts.length) % opts.length]!); }
                  }}
                >
                  {(["dog", "cat"] as Species[]).map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={species === s} tabIndex={species === s ? 0 : -1} onClick={() => setSpecies(s)} className={`py-3 rounded-xl font-heading font-medium text-sm transition-all border ${species === s ? "bg-accent border-accent text-white" : "bg-paper border-coffee/30 text-brown hover:bg-coffeeLight"}`}>
                      {s === "dog" ? "Dog" : "Cat"}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="bg-paper border border-coffee/30 rounded-2xl p-5 mb-6">
                <legend className={cls.labelAccent + " px-2"}>Consent</legend>
                {[
                  { id: "ai",  v: consentAi,        set: setConsentAi,        label: "I understand my photos will be sent to our SoliVana AI vision partner for analysis. Output is AI-generated and may contain errors." },
                  { id: "nh",  v: consentNoHumans,  set: setConsentNoHumans,  label: "No identifiable people (faces, hands, tattoos) are visible in these photos." },
                  { id: "age", v: consentAge,       set: setConsentAge,       label: "I am 18 years of age or older." },
                ].map((c) => (
                  <label key={c.id} className="flex items-start gap-3 mb-3 last:mb-0 cursor-pointer">
                    <input type="checkbox" checked={c.v} onChange={(e) => c.set(e.target.checked)} className="mt-1 w-4 h-4 accent-accent flex-shrink-0" />
                    <span className="text-sm font-body text-coffeeText">{c.label}</span>
                  </label>
                ))}
              </fieldset>

              <button
                onClick={() => collectedCount > 0 && allConsented && onSubmit(photos, species)}
                disabled={collectedCount === 0 || !allConsented}
                className={cls.btnPrimary + " w-full text-base !py-4 disabled:opacity-60 disabled:cursor-not-allowed"}
              >
                <I.Sparkle /> Analyze <I.ArrowR />
              </button>

              <div className="flex items-start gap-2 mt-4">
                <I.Lock c="w-4 h-4 text-coffeeText mt-0.5 flex-shrink-0" />
                <p className="text-xs text-brown font-body">Photos are sent to SoliVana's AI vision system for analysis only. They aren't retained by default and aren't stored on our servers.</p>
              </div>
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  INNERVIEW — 1-photo capture + analyzing + result           */
/*  10 features: context, mood bubble, confidence, regions,    */
/*  share card, chat coach, timeline, breed warn, quality,     */
/*  pain alert                                                  */
/* ═══════════════════════════════════════════════════════════ */

/* ─── Mood Bubble: 2D Valence-Arousal chart ─── */
function MoodBubble({ valence, arousal, emotion }: { valence: number; arousal: number; emotion: string }) {
  const cx = 50 + valence * 45; // -1..1 → 5..95
  const cy = 50 - arousal * 45; // -1..1 → 95..5 (inverted Y)
  const colors: Record<string, string> = { Happy: "#8FAE8F", Sad: "#6B8BA4", Anxious: "#D4A574", Relaxed: "#9BB89B", Alert: "#C9A96E", "In Pain": "#C4847A", Neutral: "#A09890" };
  const color = colors[emotion] || "#D4A574";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="w-40 h-40">
        {/* Background quadrants */}
        <rect x="0" y="0" width="50" height="50" fill="#F5F0EB" opacity="0.5" />
        <rect x="50" y="0" width="50" height="50" fill="#F5F0EB" opacity="0.3" />
        <rect x="0" y="50" width="50" height="50" fill="#F5F0EB" opacity="0.3" />
        <rect x="50" y="50" width="50" height="50" fill="#F5F0EB" opacity="0.5" />
        {/* Crosshairs */}
        <line x1="50" y1="5" x2="50" y2="95" stroke="#E8E0D8" strokeWidth="1" />
        <line x1="5" y1="50" x2="95" y2="50" stroke="#E8E0D8" strokeWidth="1" />
        {/* Labels */}
        <text x="50" y="4" textAnchor="middle" fontSize="4" fill="#A09890">Activated</text>
        <text x="50" y="99" textAnchor="middle" fontSize="4" fill="#A09890">Calm</text>
        <text x="2" y="52" textAnchor="start" fontSize="4" fill="#A09890">Unpleasant</text>
        <text x="98" y="52" textAnchor="end" fontSize="4" fill="#A09890">Pleasant</text>
        {/* Dot */}
        <circle cx={cx} cy={cy} r="6" fill={color} opacity="0.9" />
        <circle cx={cx} cy={cy} r="10" fill={color} opacity="0.2" />
      </svg>
      <p className="text-[10px] font-hero tracking-wider uppercase text-coffeeText mt-1">Valence × Arousal</p>
    </div>
  );
}

/* ─── Confidence Badge ─── */
function ConfidenceBadge({ score }: { score: number }) {
  const { label, color, bg } =
    score >= 85 ? { label: "High confidence", color: "text-green-700", bg: "bg-green-50 border-green-200" } :
    score >= 60 ? { label: "Moderate confidence", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" } :
    { label: "Low confidence — try another photo", color: "text-red-700", bg: "bg-red-50 border-red-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-hero tracking-wider uppercase border ${bg} ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: score >= 85 ? "#8FAE8F" : score >= 60 ? "#D4A574" : "#C4847A" }} />
      {label} · {score}%
    </span>
  );
}

/* ─── Region Pills ─── */
function RegionPills({ regions }: { regions: string[] }) {
  const icons: Record<string, string> = { eyes: "👁️", ears: "👂", mouth: "👄", nose: "👃" };
  return (
    <div className="flex flex-wrap gap-2">
      {regions.map((r) => (
        <span key={r} className="text-[11px] font-hero tracking-wider uppercase px-2.5 py-1 bg-accent/10 text-accent rounded-full flex items-center gap-1">
          {icons[r] || "•"} {r}
        </span>
      ))}
    </div>
  );
}

/* ─── Chat Coach ─── */
function ChatCoach({ reading, petName }: { reading: string; petName?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{role: "user" | "assistant"; text: string}[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const coach = trpc.innerview.coach.useMutation();

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const res = await coach.mutateAsync({
        reading,
        question: userMsg,
        deviceId: getDeviceId(),
        petName,
        history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      });
      if (res.success) {
        setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: res.message }]);
      }
    } catch (err: any) {
      console.error("[Coach] request failed:", err);
      setMessages((m) => [...m, { role: "assistant", text: "The Coach is having trouble connecting. Try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-heading text-brown hover:text-accent transition-colors">
        <span className="text-lg">💬</span> Ask follow-up questions {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-3 bg-paper border border-coffee/20 rounded-2xl overflow-hidden">
          <div ref={scrollRef} className="h-56 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm font-heading text-brown mb-1">Your personal AI Pet Coach</p>
                <p className="text-xs text-coffeeText">Ask anything about the reading — what it means, what to watch for, or how to help {petName || "them"} feel better.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "text-brown text-right" : "text-coffeeText"}`}>
                <span className={`inline-block px-3 py-2 rounded-xl ${m.role === "user" ? "bg-accent/10" : "bg-soft"}`}>{m.text}</span>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-coffeeText italic">
                <span className="w-4 h-4 border-2 border-coffee/20 border-t-accent rounded-full animate-spin" />
                SoliVana AI is thinking…
              </div>
            )}
          </div>
          <div className="flex gap-2 p-3 border-t border-coffee/10">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} placeholder="Ask a question…" className="flex-1 px-3 py-2 rounded-xl border border-coffee/20 bg-soft text-sm focus:border-accent focus:outline-none" />
            <button onClick={send} disabled={loading || !input.trim()} className={cls.btnPrimary + " !px-3 !py-2 text-sm disabled:opacity-50"}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Strip markdown bold/italic ─── */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/\n?---\n?/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ─── Emotional View Capture Screen ─── */
function InnerViewCaptureScreen({ onSubmit, onClose, onAbout, onFullScan, onSignOut }: {
  onSubmit: (photo: string, species: Species, context?: { location: string; recentEvent: string }, breed?: string, petName?: string) => void;
  onClose: () => void; onAbout?: () => void; onFullScan?: () => void; onSignOut?: () => void;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [location, setLocation] = useState("home");
  const [recentEvent, setRecentEvent] = useState("nothing");
  const [customEvent, setCustomEvent] = useState("");
  const [petName, setPetName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [consentAi, setConsentAi] = useState(false);
  const [consentNoHumans, setConsentNoHumans] = useState(false);
  const [consentAge, setConsentAge] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const allConsented = consentAi && consentNoHumans && consentAge;

  const brachycephalic = ["pug", "bulldog", "french bulldog", "boxer", "shih tzu", "pekingese", "boston terrier", "persian", "exotic shorthair", "himalayan", "burmese"];
  const isBrachy = brachycephalic.some((b) => breed.toLowerCase().includes(b));

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!/^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      playChime("error");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Image is too large. Please choose one under 15MB.");
      playChime("error");
      return;
    }
    // Photo quality gate: check dimensions
    const img = new Image();
    img.onload = () => {
      if (img.width < 200 || img.height < 200) {
        setError("Photo is too small. Please use a clearer, closer photo of your pet's face.");
        playChime("error");
        return;
      }
      const dataUrl = reader.result as string;
      setPhoto(dataUrl);
      playChime("capture");
      triggerHaptic();
    };
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result as string; };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout ?? (() => {})} onScan={onClose} onSignOut={onSignOut} />
      <main className={cls.container + " py-10 lg:py-16 max-w-2xl mx-auto"}>
        <button onClick={onClose} className={cls.btnGhost + " mb-6"}><I.ArrowL /> Back</button>
        {onFullScan && <ScanModeSwitcher active="innerview" onInnerView={() => {}} onFullScan={onFullScan} />}
        <p className={cls.labelAccent + " mb-3"}>Emotional View</p>
        <h1 className={cls.h1 + " text-3xl lg:text-4xl mb-6"}>See how they feel.</h1>
        <p className={cls.body + " mb-6"}>One photo of your pet's face. Emotional View reads their emotional state through TCM, Ayurveda, and bioenergetics — in about 30 seconds.</p>

        {/* AI Disclosure — required for transparency and trust */}
        <div className="mb-8 bg-paper border border-coffee/20 rounded-2xl p-5">
          <p className="text-xs text-coffeeText leading-relaxed">
            <span className="font-hero tracking-wider uppercase text-accent text-[10px]">AI-Generated Wellness Impression</span>
            <br />
            PetView is an AI-powered observational tool, not a veterinary diagnostic device. It does not diagnose, treat, or prevent any condition. The reading you receive is an impression — a gentle interpretation of visible cues through traditional wellness frameworks. Always consult a licensed veterinarian for diagnosis or care decisions.
          </p>
        </div>

        {/* Species */}
        <div className="mb-6">
          <p className="font-heading text-sm text-brown mb-3">What kind of pet?</p>
          <div className="flex gap-3">
            {(["dog", "cat"] as Species[]).map((s) => (
              <button key={s} onClick={() => setSpecies(s)} className={`flex-1 rounded-xl border px-4 py-3 text-sm font-heading capitalize transition-all ${species === s ? "border-accent bg-accent/10 text-accent" : "border-coffee/20 bg-paper text-brown hover:border-coffee/40"}`}>
                {s === "dog" ? "🐕 Dog" : "🐈 Cat"}
              </button>
            ))}
          </div>
        </div>

        {/* Pet name */}
        <div className="mb-6">
          <label className="block text-xs font-hero tracking-wider uppercase text-coffeeText mb-2">Pet's name <span className="text-coffeeText/60">(optional)</span></label>
          <input type="text" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="e.g. Luna, Max" className="w-full px-4 py-3 rounded-xl border border-coffee/20 bg-paper font-body text-brown focus:border-accent focus:outline-none text-sm" />
        </div>

        {/* Breed (optional, for warnings) */}
        <div className="mb-6">
          <label className="block text-xs font-hero tracking-wider uppercase text-coffeeText mb-2">Breed <span className="text-coffeeText/60">(optional)</span></label>
          <input type="text" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Golden Retriever, Tabby" className="w-full px-4 py-3 rounded-xl border border-coffee/20 bg-paper font-body text-brown focus:border-accent focus:outline-none text-sm" />
          {isBrachy && (
            <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Flat-faced breeds have reduced facial dynamics. Confidence may be lower — we adjust our reading to be more cautious.
            </p>
          )}
        </div>

        {/* Context questions */}
        <div className="mb-6 bg-paper border border-coffee/20 rounded-2xl p-5">
          <p className="font-heading text-sm text-brown mb-3">A little context helps us read more accurately <span className="text-coffeeText/60 font-normal">(optional)</span></p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-hero tracking-wider uppercase text-coffeeText mb-1.5">Where is your pet right now?</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: "home", label: "🏠 Home" },
                  { val: "vet", label: "🏥 Vet" },
                  { val: "park", label: "🌳 Park" },
                  { val: "other", label: "📍 Other" },
                ].map((opt) => (
                  <button key={opt.val} onClick={() => setLocation(opt.val)} className={`px-3 py-1.5 rounded-lg text-xs font-heading border transition-all ${location === opt.val ? "border-accent bg-accent/10 text-accent" : "border-coffee/20 text-brown hover:border-coffee/40"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-hero tracking-wider uppercase text-coffeeText mb-1.5">What just happened?</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { val: "nothing", label: "Nothing special" },
                  { val: "playtime", label: "🎾 Playtime" },
                  { val: "meal", label: "🍖 Meal" },
                  { val: "scary_noise", label: "⚡ Scary noise" },
                  { val: "other", label: "Something else" },
                ].map((opt) => (
                  <button key={opt.val} onClick={() => setRecentEvent(opt.val)} className={`px-3 py-1.5 rounded-lg text-xs font-heading border transition-all ${recentEvent === opt.val ? "border-accent bg-accent/10 text-accent" : "border-coffee/20 text-brown hover:border-coffee/40"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {recentEvent === "other" && (
                <input
                  type="text"
                  value={customEvent}
                  onChange={(e) => setCustomEvent(e.target.value)}
                  placeholder="Describe what happened..."
                  className="mt-3 w-full px-3 py-2 rounded-xl border border-coffee/20 bg-soft text-sm focus:border-accent focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>

        {/* Upload */}
        <div
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors mb-6 ${dragOver ? "border-accent bg-accent/5" : "border-coffee/20 bg-paper"} ${photo ? "border-solid border-accent/30" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Preview" className="max-h-64 mx-auto rounded-xl object-contain" />
              <button onClick={() => setPhoto(null)} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-brown/80 text-paper text-xs hover:bg-brown">✕</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="w-full">
              <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <p className="font-heading text-brown mb-1">Drop a photo or click to browse</p>
              <p className="text-xs text-coffeeText">JPEG, PNG, or WebP — up to 15MB</p>
            </button>
          )}
        </div>

        {error && <p className="text-accent text-sm mb-4">{error}</p>}

        {/* Consent */}
        <div className="bg-paper border border-coffee/20 rounded-2xl p-5 mb-6 space-y-3">
          <p className="font-heading text-sm text-brown mb-2">Before we begin</p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consentAi} onChange={(e) => setConsentAi(e.target.checked)} className="mt-1 accent-accent" />
            <span className="text-sm text-coffeeText">I understand this is AI-generated observational information, not a veterinary diagnosis.</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consentNoHumans} onChange={(e) => setConsentNoHumans(e.target.checked)} className="mt-1 accent-accent" />
            <span className="text-sm text-coffeeText">The photo contains only my pet — no people.</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consentAge} onChange={(e) => setConsentAge(e.target.checked)} className="mt-1 accent-accent" />
            <span className="text-sm text-coffeeText">I am 18 or older.</span>
          </label>
        </div>

        <button
          onClick={() => photo && onSubmit(photo, species, { location, recentEvent: recentEvent === "other" && customEvent.trim() ? customEvent.trim() : recentEvent }, breed || undefined, petName || undefined)}
          disabled={!photo || !allConsented}
          className={cls.btnPrimary + " w-full !py-4" + (!photo || !allConsented ? " opacity-50 cursor-not-allowed" : "")}
        >
          <I.Paw /> See how my pet feels
        </button>
      </main>
      <Footer />
    </div>
  );
}

/* ─── Emotional View Analyzing Screen ─── */
function InnerViewAnalyzingScreen({ photo, species, context, petName, onComplete, onPaywall, onSignin, onRetry, onAbout, onSignOut }: {
  photo: string; species: Species; context: { location: string; recentEvent: string } | null; petName?: string;
  onComplete: (text: string, emotion?: { dominantEmotion: string; confidence: number; valence: number; arousal: number; regionsObserved: string[]; contextualNote: string }) => void;
  onPaywall: (links: PaymentLinks) => void; onSignin?: () => void; onRetry?: () => void; onAbout?: () => void; onSignOut?: () => void;
}) {
  const [status, setStatus] = useState("Reading your photo…");
  const [error, setError] = useState<string | null>(null);
  const mutate = trpc.innerview.analyze.useMutation();

  useEffect(() => {
    const base64 = photo.includes(",") ? photo.split(",")[1]! : photo;
    const payload: any = { imageBase64: base64, species, deviceId: getDeviceId(), unlockToken: getUnlockToken(), sessionToken: getSessionToken() };
    if (context) payload.context = context;
    if (petName) payload.petName = petName;
    mutate.mutate(payload, {
      onSuccess: (res) => {
        if (res.success) {
          setStatus("Done");
          onComplete(res.text, res.emotion);
        } else if (res.code === "needs_signin") {
          onSignin?.();
        } else if (res.code === "paywall" && res.paymentLinks) {
          onPaywall(res.paymentLinks);
        } else {
          setError(res.message);
        }
      },
      onError: (err) => {
        console.error("[Emotional View] analyze error:", err);
        setError(err.message || "Something went wrong. Please try again.");
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-soft flex flex-col">
      <Header onAbout={onAbout ?? (() => {})} onScan={() => {}} onSignOut={onSignOut} />
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        {error ? (
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-accent/10 mx-auto mb-4 flex items-center justify-center text-2xl">🌿</div>
            <p className="font-heading text-xl text-brown mb-2">We're having trouble connecting</p>
            <p className="text-coffeeText text-sm mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={onRetry} className={cls.btnPrimary}>Try again</button>
              <button onClick={() => window.location.reload()} className={cls.btnSecondary}>Refresh</button>
            </div>
          </div>
        ) : (
          <div className="text-center max-w-md">
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-coffee/10" />
              <div className="absolute inset-0 rounded-full border-4 border-t-accent border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl">💜</span>
              </div>
            </div>
            <h2 className={cls.h2 + " text-2xl mb-2"}>Emotional View is reading…</h2>
            <p className={cls.body + " text-sm"}>{status}</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

/* ─── Emotional View Result Screen ─── */
function InnerViewResultScreen({ text, emotion, photo, species, breed, petName, onNewScan, onFullScan, onClose, onAbout, onSignin, onSignOut }: {
  text: string; emotion: { dominantEmotion: string; confidence: number; valence: number; arousal: number; regionsObserved: string[]; contextualNote: string } | null;
  photo: string; species: Species; breed?: string; petName?: string; onNewScan: () => void; onFullScan: () => void; onClose: () => void; onAbout?: () => void; onSignin?: () => void; onSignOut?: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDataUrl, setShareDataUrl] = useState("");
  const domEmotion = emotion?.dominantEmotion || "Neutral";
  const confidence = emotion?.confidence || 60;
  const isPain = domEmotion === "In Pain";
  const shareFilename = `petview-${species}-${Date.now()}.png`;

  const emotionColors: Record<string, string> = { Happy: "#8FAE8F", Sad: "#6B8BA4", Anxious: "#D4A574", Relaxed: "#9BB89B", Alert: "#C9A96E", "In Pain": "#C4847A", Neutral: "#A09890" };
  const emotionBg: Record<string, string> = { Happy: "bg-green-50", Sad: "bg-blue-50", Anxious: "bg-amber-50", Relaxed: "bg-green-50", Alert: "bg-yellow-50", "In Pain": "bg-red-50", Neutral: "bg-gray-50" };

  const shareData = useMemo(() => {
    return {
      title: `Emotional View: ${domEmotion}`,
      text: `My ${species} is feeling ${domEmotion.toLowerCase()} — read through TCM, Ayurveda, and bioenergetics.`,
      url: "https://petview.solivana.io/",
    };
  }, [domEmotion, species]);

  // Save to local timeline
  useEffect(() => {
    try {
      const timeline = JSON.parse(localStorage.getItem("petview_innerview_timeline") || "[]");
      timeline.unshift({ date: new Date().toISOString(), emotion: domEmotion, confidence, species });
      setStorageItem("petview_innerview_timeline", JSON.stringify(timeline.slice(0, 30)));
    } catch {}
  }, [domEmotion, confidence, species]);

  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout ?? (() => {})} onScan={onClose} onSignin={onSignin} onSignOut={onSignOut} />
      <main className={cls.container + " py-8 lg:py-12"}>
        <button onClick={onClose} className={cls.btnGhost + " mb-6"}><I.ArrowL /> Back to home</button>

        <div className="max-w-3xl mx-auto">
          {/* Header with photo */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-coffeeLight flex-shrink-0 border-2 border-accent/20">
              <img src={photo} alt="Your pet" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className={cls.labelAccent}>Emotional View</p>
              <h1 className={cls.h2 + " text-3xl sm:text-4xl lg:text-5xl"}>How {petName || breed || "your pet"} is feeling</h1>
            </div>
          </div>

          {/* AI Disclosure — persistent on result screen */}
          <div className="mb-6 bg-paper border border-coffee/20 rounded-2xl p-4">
            <p className="text-[11px] text-coffeeText leading-relaxed">
              <span className="font-hero tracking-wider uppercase text-accent text-[10px]">AI-Generated Impression · Not a Veterinary Diagnosis</span>
              <br />
              This reading was generated by artificial intelligence as an observational wellness impression. It does not diagnose, treat, cure, or prevent any condition. Always consult a licensed veterinarian for diagnosis or care decisions.
            </p>
          </div>

          {/* Pain alert */}
          {isPain && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="font-heading text-red-800 mb-1">Possible pain or distress detected</p>
                <p className="text-sm text-red-700">This reading suggests your pet may be experiencing discomfort. PetView is not a diagnosis — please contact your veterinarian to discuss these findings.</p>
              </div>
            </div>
          )}

          {/* Visual emotion result */}
          {emotion && (
            <div className={`${emotionBg[domEmotion] || "bg-paper"} border border-coffee/20 rounded-2xl p-6 mb-6`}>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <MoodBubble valence={emotion.valence} arousal={emotion.arousal} emotion={domEmotion} />
                <div className="flex-1 text-center sm:text-left">
                  <p className="font-hero text-[11px] tracking-[0.22em] uppercase text-coffeeText mb-2">Dominant emotion</p>
                  <p className="font-heading text-3xl lg:text-4xl mb-3" style={{ color: emotionColors[domEmotion] || "#D4A574" }}>{domEmotion}</p>
                  <div className="mb-3"><ConfidenceBadge score={confidence} /></div>
                  <RegionPills regions={emotion.regionsObserved} />
                  {emotion.contextualNote && (
                    <p className="text-xs text-coffeeText mt-3 italic">{emotion.contextualNote}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Detailed reading (collapsible) */}
          <div className="mb-6">
            <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm font-heading text-brown hover:text-accent transition-colors mb-3">
              {showDetails ? "▲" : "▼"} {showDetails ? "Hide" : "Read"} the full wellness impression
            </button>
            {showDetails && <InnerViewPanel text={stripMarkdown(text)} onSaveToTimeline={() => setSaved(true)} saved={saved} />}
          </div>

          {/* AI Coach */}
          <ChatCoach reading={text} petName={petName} />

          {/* Actions */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onNewScan} className={cls.btnPrimary}><I.Paw /> New Emotional View</button>
            <button onClick={onFullScan} className={cls.btnSecondary}>Try the Wellness Scan <I.ArrowR /></button>
            <button
              onClick={async () => {
                // Extract just the prose body of the first parsed section, so
                // the share card doesn't render "WHAT YOUR PET MAY BE
                // COMMUNICATING" as part of the excerpt text.
                const sections = parseInnerView(stripMarkdown(text));
                const firstBody = sections[0]?.body ?? stripMarkdown(text);
                const dataUrl = generateEmotionalViewCard({
                  dominantEmotion: domEmotion,
                  confidence,
                  contextualNote: emotion?.contextualNote,
                  textExcerpt: firstBody.replace(/\n+/g, " ").trim(),
                  sectionLabel: sections[0]?.heading,
                  species,
                  petName,
                });
                if (!dataUrl) return;

                // 1) Try native share sheet with image + URL (mobile, Safari).
                //    If supported, that's the best UX — system share sheet
                //    with all the user's installed apps. Skip the modal.
                const file = dataUrlToFile(dataUrl, shareFilename);
                const nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined;
                if (file && nav?.canShare?.({ files: [file] }) && nav.share) {
                  try {
                    await nav.share({ ...shareData, files: [file] });
                    return;
                  } catch { /* user cancelled — fall through to in-app modal */ }
                }

                // 2) No file-share support → open our in-app modal with the
                //    card preview + Copy Image / Copy Link / Download buttons.
                setShareDataUrl(dataUrl);
                setShareOpen(true);
              }}
              className={cls.btnGhost}
            >Share result</button>
          </div>
        </div>
      </main>
      <Footer />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        dataUrl={shareDataUrl}
        filename={shareFilename}
        shareUrl={shareData.url}
        shareText={shareData.text}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  ANALYZING                                                   */
/* ═══════════════════════════════════════════════════════════ */
type ApiResponse =
  | { success: true; analysis: ScanAnalysis }
  | { success: false; code: string; message: string; paymentLinks?: PaymentLinks };

function useAnalysisStages(status: string) {
  const stages = [
    { label: "Receiving photos…", icon: "📥", color: "#D4A574" },
    { label: "Checking clarity…", icon: "🔍", color: "#D4A574" },
    { label: "Reading the emotional layer…", icon: "💜", color: "#B8A9C9" },
    { label: "Observing physical patterns…", icon: "🌿", color: "#8FAE8F" },
    { label: "Compiling your reading…", icon: "✨", color: "#D4A574" },
  ];
  const idx = stages.findIndex((s) => status.toLowerCase().includes(s.label.toLowerCase().split(" ")[0]));
  const active = idx >= 0 ? idx : 0;
  return { stages, active };
}

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function ScrollReveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${visible ? "visible" : ""} ${className}`} style={{ transitionDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

function AnalyzingScreen({ photos, species, onComplete, onPaywall, onSignin, onRetry, onAbout, petName, onSignOut }: {
  photos: PhotoMap;
  species: Species;
  petName?: string;
  onComplete: (r: ScanAnalysis) => void;
  onPaywall: (links: PaymentLinks) => void;
  onSignin?: () => void;
  onRetry: () => void;
  onAbout?: () => void;
  onSignOut?: () => void;
}) {
  const [status, setStatus] = useState("Receiving photos…");
  const [errState, setErrState] = useState<{ msg: string; code: string } | null>(null);
  const [tipIdx, setTipIdx] = useState(0);
  const { stages, active } = useAnalysisStages(status);
  const name = petName || "your pet";
  const didYouKnow = [
    "TCM practitioners have read tongue, gum, and eye color for over 2,000 years to assess Qi flow.",
    "Ayurveda classifies pets into Vata, Pitta, and Kapha doshas — each with distinct energetic signatures.",
    "In bioenergetics, chronic ear issues often trace to Kidney or Liver meridian imbalance.",
    "A dry, warm nose in TCM can indicate Lung Qi deficiency or internal heat accumulation.",
    "The eyes are called 'the window to the liver' in both TCM and Ayurvedic traditions.",
  ];
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const mutation = trpc.scan.analyze.useMutation({
    onSuccess: (data: ApiResponse) => {
      if (!mounted.current) return;
      if (data.success) {
        setStatus("Compiling your reading…");
        playChime("bloom");
        triggerHaptic();
        setTimeout(() => { if (mounted.current) onComplete(data.analysis); }, 600);
      } else if (data.code === "paywall" && data.paymentLinks) {
        onPaywall(data.paymentLinks);
      } else if (data.code === "needs_signin" && onSignin) {
        console.log("[PetView] routing to signin from analyzing (needs_signin)");
        onSignin();
      } else {
        setErrState({ msg: data.message, code: data.code });
        playChime("error");
      }
    },
    onError: (err) => {
      if (!mounted.current) return;
      setErrState({ msg: err.message || "Connection error. Please try again.", code: "network_error" });
      playChime("error");
    },
  });

  useEffect(() => {
    setStatus("Receiving photos…");
    setTipIdx(0);
    const messages = [
      { at: 1500, m: "Checking clarity…" },
      { at: 3500, m: "Reading the emotional layer — TCM, Ayurveda, bioenergetics…" },
      { at: 9000, m: "Observing physical patterns through traditional wellness frameworks…" },
      { at: 14000, m: "Compiling your reading…" },
    ];
    const timers = messages.map((s) => setTimeout(() => setStatus(s.m), s.at));
    const photoArray = AREAS
      .map((a) => ({ area: a.id, base64: photos[a.id] }))
      .filter((p): p is { area: ScanArea; base64: string } => Boolean(p.base64))
      .map((p) => ({ area: p.area, imageBase64: p.base64 }));
    mutation.mutate({
      species,
      photos: photoArray,
      deviceId: getDeviceId(),
      sessionToken: getSessionToken(),
      unlockToken: getUnlockToken(),
    });
    const tipTimer = setInterval(() => {
      setTipIdx((i) => (i + 1) % didYouKnow.length);
    }, 5000);
    return () => { timers.forEach(clearTimeout); clearInterval(tipTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, species]);

  if (errState) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center px-6">
        <div className="bg-paper border border-coffee/30 rounded-2xl p-8 max-w-md w-full text-center animate-pop-in">
          <div className="w-16 h-16 rounded-full bg-coffeeLight mx-auto mb-5 flex items-center justify-center text-accent animate-gentle-float">
            <span className="text-2xl">🍃</span>
          </div>
          <h2 className="font-heading text-xl text-brown mb-2">We couldn't complete {name}'s reading this time.</h2>
          <p className={cls.body + " mb-2"}>{errState.msg}</p>
          <p className={cls.body + " text-sm text-coffeeText mb-6"}>Our AI vision partner may be experiencing high demand. Your photos are safe — nothing was stored.</p>
          <div className="flex flex-col gap-3">
            <button onClick={onRetry} className={cls.btnPrimary}>Try again</button>
            <button onClick={() => window.location.href = "mailto:info@solivana.com?subject=Emotional%20View%20Scan%20Issue"} className={cls.btnGhost + " text-xs"}>
              Contact support
            </button>
          </div>
        </div>
      </div>
    );
  }

  const photosCount = Object.keys(photos).length;

  return (
    <div className="min-h-screen bg-soft flex flex-col">
      <Header onAbout={onAbout ?? (() => {})} onScan={() => {}} onSignOut={onSignOut} />
      <main id="main" tabIndex={-1} className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Stage dots */}
        <div className="flex items-center gap-2 mb-8" aria-hidden>
          {stages.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${i <= active ? "bg-accent scale-110" : "bg-coffee/30"}`} />
              {i < stages.length - 1 && <div className={`w-6 h-px transition-all duration-500 ${i < active ? "bg-accent" : "bg-coffee/20"}`} />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-10 max-w-sm" aria-hidden>
          {AREAS.map((a, i) => (
            <div key={a.id} className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-coffee/30">
              {photos[a.id] ? (
                <>
                  <img src={photos[a.id]} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                  <div className="scan-pulse" style={{ animationDelay: `${i * 0.55}s` }} />
                </>
              ) : (
                <div className="w-full h-full bg-coffeeLight flex items-center justify-center">
                  <span className="text-[10px] font-hero tracking-wider uppercase text-coffeeText">Skipped</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="w-full max-w-md text-center" role="status" aria-live="polite">
          <p className="font-heading text-lg text-brown mb-2">{status}</p>
          <div className="h-1 bg-coffeeLight rounded-full overflow-hidden">
            <div className="h-full shimmer-bar" />
          </div>
          <p className="text-xs font-hero tracking-[0.22em] uppercase text-coffeeText mt-4">
            Reading {photosCount} {photosCount === 1 ? "photo" : "photos"} · usually 15 to 25 seconds
          </p>
          <div className="mt-6 bg-accent/5 border border-accent/20 rounded-xl p-4 max-w-md mx-auto">
            <p className="text-xs font-hero tracking-wider uppercase text-accent mb-1">Did you know?</p>
            <p className="text-sm text-brown font-body transition-opacity duration-500">{didYouKnow[tipIdx]}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  RESULT                                                      */
/* ═══════════════════════════════════════════════════════════ */
function statusBadge(s: ScanAnalysis["overallStatus"]) {
  switch (s) {
    case "looking_healthy":      return { label: "Looking healthy",       bg: "bg-green-100",   text: "text-green-800",  ring: "ring-green-200", score: 85 };
    case "worth_watching":       return { label: "A few things to watch", bg: "bg-coffeeLight", text: "text-brown",       ring: "ring-coffee/40", score: 65 };
    case "share_with_vet":       return { label: "Share with your vet",   bg: "bg-accent/15",   text: "text-accent",     ring: "ring-accent/30", score: 45 };
    case "couldnt_see_clearly":  return { label: "Photos weren't clear",  bg: "bg-coffeeLight", text: "text-coffeeText", ring: "ring-coffee/40", score: 0 };
  }
}

function PetAvatar({ species, wellness }: { species: string; wellness: ScanAnalysis["overallStatus"] }) {
  const aura = wellness === "looking_healthy" ? "#8FAE8F" : wellness === "worth_watching" ? "#D4A574" : "#C4847A";
  return (
    <div className="relative w-20 h-20 flex-shrink-0" aria-hidden>
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <circle cx="40" cy="40" r="36" fill={aura} opacity="0.15" />
        <circle cx="40" cy="40" r="36" fill="none" stroke={aura} strokeWidth="2" opacity="0.4" />
        {species === "cat" ? (
          <g transform="translate(20, 22) scale(1.4)" fill="#331D01" opacity="0.9">
            <path d="M14 2c-1.5 0-2.8.8-3.5 2L8 8H4l-1 4h2l1 10h4l1-4h4l1 4h4l1-10h2l-1-4h-4l-2.5-4c-.7-1.2-2-2-3.5-2z" />
            <circle cx="9" cy="14" r="1" fill="#FFF8F0" />
            <circle cx="19" cy="14" r="1" fill="#FFF8F0" />
          </g>
        ) : (
          <g transform="translate(20, 20) scale(1.4)" fill="#331D01" opacity="0.9">
            <path d="M14 4c-3 0-5.5 2-6 5l-1 3H4l-1 2h2l1 8h4l1-3h4l1 3h4l1-8h2l-1-2h-3l-1-3c-.5-3-3-5-6-5z" />
            <circle cx="10" cy="13" r="1" fill="#FFF8F0" />
            <circle cx="18" cy="13" r="1" fill="#FFF8F0" />
          </g>
        )}
      </svg>
    </div>
  );
}

function WellnessRing({ score, label }: { score: number; label: string }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const color = score >= 80 ? "#8FAE8F" : score >= 50 ? "#D4A574" : "#C4847A";
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#F0EDED" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={circumference}
            className="animate-ring-fill"
            style={{ "--ring-offset": offset } as React.CSSProperties}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center animate-pop-in delay-400">
          <span className="font-hero text-2xl sm:text-3xl text-brown leading-none">{score}</span>
          <span className="text-[10px] font-hero tracking-wider uppercase text-coffeeText">/ 100</span>
        </div>
      </div>
      <div className="text-center sm:text-left animate-fade-in-up delay-300">
        <p className="font-heading text-lg sm:text-xl text-brown">Wellness Score</p>
        <p className="text-sm text-coffeeText">{label}</p>
      </div>
    </div>
  );
}

function concernPill(c: ScanAnalysis["areas"][number]["concern"]) {
  switch (c) {
    case "share_with_vet": return "bg-accent/15 text-accent";
    case "moderate":       return "bg-coffeeLight text-brown";
    case "low":            return "bg-green-50 text-green-800";
    case "none":           return "bg-coffeeLight text-coffeeText";
  }
}

// Parse the Emotional View Claude response into four labeled sections. The model
// is instructed to emit the headings uppercase on their own line. If the
// shape drifts we fall back to "render the whole text in the first slot"
// so a usable reading still surfaces.
const INNERVIEW_HEADINGS = [
  "WHAT YOUR PET MAY BE COMMUNICATING",
  "WHAT WE NOTICED",
  "WHAT YOUR PET MAY NEED RIGHT NOW",
  "A NOTE ON THIS READING",
] as const;

function parseInnerView(text: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  for (let i = 0; i < INNERVIEW_HEADINGS.length; i++) {
    const h = INNERVIEW_HEADINGS[i];
    const next = INNERVIEW_HEADINGS[i + 1];
    const idx = text.indexOf(h);
    if (idx === -1) continue;
    const bodyStart = idx + h.length;
    const bodyEnd = next ? text.indexOf(next, bodyStart) : -1;
    const body = (bodyEnd === -1 ? text.slice(bodyStart) : text.slice(bodyStart, bodyEnd)).trim();
    sections.push({ heading: h, body });
  }
  return sections.length > 0 ? sections : [{ heading: INNERVIEW_HEADINGS[0], body: text.trim() }];
}

function InnerViewPanel({ text, onSaveToTimeline, saved }: { text: string; onSaveToTimeline?: () => void; saved?: boolean }) {
  const sections = parseInnerView(text);
  return (
    <section aria-labelledby="innerview-heading" className="mb-12 rounded-3xl border border-[#EC9247]/40 p-7 lg:p-10" style={{ backgroundColor: '#F5EFE8' }}>
      <p className="font-hero text-[11px] tracking-[0.22em] uppercase mb-3" style={{ color: '#EC9247' }}>AI-generated · Wellness impression, not veterinary advice</p>
      <div className="flex items-center gap-3 mb-6">
        <span className="font-hero text-[11px] tracking-[0.22em] uppercase" style={{ color: '#EC9247' }}>The emotional layer</span>
        <span aria-hidden className="h-px flex-1 bg-[#EC9247]/30" />
      </div>
      <h2 id="innerview-heading" className="font-heading text-2xl lg:text-3xl mb-2" style={{ color: '#331D01' }}>What your pet may be communicating</h2>
      <p className="font-heading text-sm mb-8" style={{ color: '#786455' }}>An emotional wellness impression. Not a medical assessment.</p>
      <div className="space-y-5">
        {sections.map((s, i) => {
          const isBullets = s.heading === "WHAT WE NOTICED";
          const isClosingNote = s.heading === "A NOTE ON THIS READING";
          const bullets = isBullets
            ? s.body.split(/\n+/).map((l) => l.trim()).filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim())
            : [];
          const paragraphs = !isBullets ? s.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : [];
          return (
            <div key={i} className={`rounded-2xl border border-[#EC9247]/20 p-5 ${isClosingNote ? 'bg-white/60' : 'bg-white'}`}>
              <h3 className="font-hero text-[11px] tracking-[0.22em] uppercase mb-3" style={{ color: isClosingNote ? '#786455' : '#EC9247' }}>{s.heading}</h3>
              {isBullets && bullets.length > 0 ? (
                <ul className="space-y-2">
                  {bullets.map((b, j) => (
                    <li key={j} className="flex gap-3">
                      <span aria-hidden className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#EC9247' }} />
                      <span className="font-heading text-base font-light leading-relaxed" style={{ color: '#331D01' }}>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={`font-heading font-light leading-relaxed space-y-3 ${isClosingNote ? "text-xs italic" : "text-base"}`} style={{ color: '#331D01' }}>
                  {(() => {
                    const paras = isBullets ? s.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : paragraphs;
                    return paras.length > 0 ? paras.map((p, j) => <p key={j}>{p}</p>) : <p>{s.body}</p>;
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Legal footer */}
      <p className="mt-6 text-xs font-heading italic" style={{ color: '#786455' }}>
        Emotional View is an emotional wellness impression for personal enrichment purposes. It does not constitute veterinary advice or medical assessment.
      </p>
      {/* Save to Timeline */}
      {onSaveToTimeline && (
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onSaveToTimeline}
            disabled={saved}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-heading transition-all ${saved ? 'bg-green-100 text-green-700' : 'bg-[#EC9247] text-white hover:opacity-90'}`}
          >
            {saved ? <><I.Check c="w-4 h-4" /> Saved to timeline</> : <><I.Heart c="w-4 h-4" /> Save to timeline</>}
          </button>
          <span className="text-xs font-body" style={{ color: '#786455' }}>Track your pet's emotional wellness over time.</span>
        </div>
      )}
    </section>
  );
}

function ConversionCard({ onUpgrade, petName }: { onUpgrade: () => void; petName?: string }) {
  const name = petName ? petName.charAt(0).toUpperCase() + petName.slice(1) : "your pet";
  return (
    <section aria-labelledby="conversion-heading" className="mb-10 rounded-3xl p-8 lg:p-10 bg-brown">
      <p className="font-hero text-[11px] tracking-[0.22em] uppercase mb-4 text-accent">You just experienced</p>
      <h2 id="conversion-heading" className="font-heading text-3xl lg:text-4xl mb-5 leading-tight text-accent">
        {name} just got their first full reading.
      </h2>
      <p className="font-body text-base mb-2 text-coffeeLight">The physical read. The emotional layer.</p>
      <p className="font-body text-base mb-6 text-coffeeLight">What {name.toLowerCase()} may be trying to tell you.</p>
      <p className="font-body text-base mb-8 text-coffeeLight">This is what unlimited membership feels like.</p>
      <button onClick={onUpgrade} className="inline-flex items-center gap-2 font-heading text-base px-7 py-3.5 rounded-full transition-opacity hover:opacity-90 bg-accent text-brown">
        See membership options <I.ArrowR />
      </button>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-hero text-[11px] tracking-[0.18em] uppercase text-coffee">
        <span>Join 2,000+ pet parents tracking wellness</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-hero text-[11px] tracking-[0.18em] uppercase text-coffee">
        <span>$19.99/month — cancel or pause anytime</span>
        <span aria-hidden>·</span>
        <span>$199/year — two months free</span>
      </div>
    </section>
  );
}

function ResultScreen({ result, photos, onClose, onNewScan, onAccount, onUpsell, onAbout, onSignin, petName, onSignOut }: {
  result: ScanAnalysis;
  photos: PhotoMap;
  petName?: string;
  onClose: () => void;
  onNewScan: () => void;
  onAccount?: () => void;
  onUpsell?: () => void;
  onAbout?: () => void;
  onSignin?: () => void;
  onSignOut?: () => void;
}) {
  const r = result;
  const badge = statusBadge(r.overallStatus);
  const photosCount = Object.values(photos).filter(Boolean).length;
  const sessionToken = getSessionToken();
  const status = trpc.access.myStatus.useQuery({ sessionToken }, { enabled: Boolean(sessionToken) });
  const showNudge = status.data?.signedIn && !status.data.hasUnlimited && status.data.totalCredits === 1;
  const innerviewText = r.innerview?.text ?? null;
  const isSignedIn = Boolean(status.data?.signedIn);
  // Show the locked upgrade card for signed-in users without Unlimited when
  // Emotional View wasn't included in this scan.
  const showConversionCard = Boolean(r.firstFreeScan && innerviewText);
  // Emotional View is included with every scan. If it's missing, the API call failed.
  const showInnerViewError = !innerviewText;

  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout ?? (() => {})} onScan={onNewScan} onAccount={onAccount} onSignOut={onSignOut} />
      {showNudge && onUpsell && (
        <div className="bg-accent/10 border-b border-accent/30">
          <div className={cls.container + " py-3 flex flex-col sm:flex-row items-center gap-3 justify-between"}>
            <p className={cls.body + " text-sm"}>
              <strong className="text-brown">1 scan left.</strong> Top up now and save <strong className="text-accent">10%</strong> — or go unlimited for $19.99/mo.
            </p>
            <button onClick={onUpsell} className={cls.btnPrimary + " !py-2 !px-5 text-xs"}>See options <I.ArrowR /></button>
          </div>
        </div>
      )}
      <VetBanner />
      <main id="main" tabIndex={-1} className={cls.container + " py-12 lg:py-16"}>
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className={cls.labelAccent}>Your reading</p>
            <h1 className={cls.h1 + " text-3xl sm:text-4xl lg:text-5xl mt-2"}>{innerviewText ? "Emotional View" : "Scan result"}</h1>
            <p className="font-body text-base text-coffeeText mt-2 max-w-xl">{innerviewText ? "What your pet may be communicating — an emotional wellness impression through the lens of traditional wellness frameworks." : "Physical wellness observation based on your photos."}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-coffeeText hover:text-brown touch-min p-2"><I.Close c="w-6 h-6" /></button>
        </div>

        {innerviewText && (
          <InnerViewPanel
            text={innerviewText}
            onSaveToTimeline={isSignedIn ? () => {} : onSignin}
            saved={isSignedIn}
          />
        )}
        {showInnerViewError && (
          <section className="mb-12 rounded-3xl border border-accent/30 bg-paper p-7 lg:p-10 text-center">
            <p className="font-heading text-lg text-brown mb-2">Emotional View is taking a moment.</p>
            <p className={cls.body + " text-sm text-coffeeText mb-4"}>Check back shortly — your pet's emotional wellness layer will appear here once it's ready.</p>
            <div className="h-1 bg-coffeeLight rounded-full overflow-hidden max-w-xs mx-auto">
              <div className="h-full shimmer-bar" />
            </div>
          </section>
        )}
        {/* Emotional View is always included — no lock card needed */}

        {/* Visual divider */}
        <div className="flex items-center gap-4 mb-10">
          <span aria-hidden className="h-px flex-1 bg-coffee/20" />
          <span className="font-hero text-[10px] tracking-[0.28em] uppercase text-coffeeText">Physical Wellness Observation</span>
          <span aria-hidden className="h-px flex-1 bg-coffee/20" />
        </div>

        <div className="bg-paper border border-coffee/30 rounded-2xl p-7 mb-10">
          <p className="font-hero text-[11px] tracking-[0.22em] uppercase text-accent mb-5">AI-generated · TCM · Ayurveda · Bioenergetics · Observation, not veterinary advice</p>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 mb-5">
            <PetAvatar species={r.species} wellness={r.overallStatus} />
            <WellnessRing score={badge.score} label={badge.label} />
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-4 mt-5">
            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-heading font-medium ${badge.bg} ${badge.text} ring-1 ${badge.ring}`}>{badge.label}</span>
            <span className="text-sm text-brown capitalize">Species observed: {r.species} · {photosCount} {photosCount === 1 ? "photo" : "photos"} read</span>
          </div>
          <div className={cls.body + " text-base space-y-4"}>
            {r.overallNote.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para.trim()}</p>
            ))}
          </div>
        </div>

        {r.photoQualityTips.length > 0 && (
          <section className="mb-10 bg-coffeeLight border border-coffee/40 rounded-2xl p-6">
            <p className={cls.labelAccent + " mb-2"}>Try clearer photos</p>
            <ul className="space-y-1">
              {r.photoQualityTips.map((t, i) => (
                <li key={i} className={cls.body + " text-sm flex gap-2"}>
                  <span className="text-accent">·</span><span>{t}</span>
                </li>
              ))}
            </ul>
            <button onClick={onNewScan} className={cls.btnPrimary + " mt-5"}><I.Camera /> Take new photos</button>
          </section>
        )}

        {/* AREA-BY-AREA WITH PHOTO THUMBNAILS */}
        {r.areas.length > 0 && (
          <section className="mb-12">
            <p className={cls.labelAccent + " mb-3"}>Area by area</p>
            <h2 className={cls.h2 + " text-2xl mb-5"}>What's visible.</h2>
            <div className="grid md:grid-cols-2 gap-5">
              {r.areas.map((a) => {
                const meta = AREAS.find((x) => x.id === a.area);
                const userPhoto = photos[a.area];
                return (
                  <article key={a.area} className="bg-paper border border-coffee/30 rounded-2xl overflow-hidden">
                    <div className="aspect-[16/9] bg-coffeeLight overflow-hidden">
                      {userPhoto ? (
                        <img src={userPhoto} alt={`Your ${meta?.label || a.area} photo`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-coffeeText">
                          <span className="text-xs font-hero tracking-wider uppercase">Photo not provided</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-heading text-lg text-brown">{meta?.label || a.area}</h3>
                        <span className={`text-xs font-hero tracking-wider uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${concernPill(a.concern)}`}>{a.concern.replace("_", " ")}</span>
                      </div>
                      <p className={cls.body + " text-sm mb-2"}>{a.observation || "Not clearly visible in this photo."}</p>
                      <p className="text-xs font-hero tracking-wider uppercase text-coffeeText">Visibility: {a.visibility.replace("_", " ")}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-12">
          {r.watchFor.length > 0 && (
            <section>
              <p className={cls.labelAccent + " mb-3"}>Worth watching</p>
              <ul className="bg-paper border border-coffee/30 rounded-2xl p-6 space-y-3">
                {r.watchFor.map((w, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="font-hero text-coffeeText flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className={cls.body + " text-sm"}>{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.shareWithVetIf.length > 0 && (
            <section>
              <p className={cls.labelAccent + " mb-3"}>Share with your vet if</p>
              <ul className="bg-accent/5 border border-accent/30 rounded-2xl p-6 space-y-3">
                {r.shareWithVetIf.map((w, i) => (
                  <li key={i} className="flex gap-3">
                    <I.Heart c="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span className={cls.body + " text-sm"}>{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="bg-paper border border-coffee/30 rounded-2xl p-6 mb-10">
          <h2 className="font-heading text-xl text-brown mb-2">Talking with your vet</h2>
          <p className={cls.body + " text-sm mb-4"}>Save these photos and the reading. Most vets are happy to look at phone photos before deciding whether an in-person visit is needed.</p>
          <p className={cls.body + " text-sm"}>If you don't have a vet you trust, the AVMA's <a href="https://www.avma.org/resources/pet-owners/your-pet/finding-veterinarian" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Find a Veterinarian</a> directory is a good place to start.</p>
        </div>

        {showConversionCard && onUpsell && <ConversionCard onUpgrade={onUpsell} petName={petName || r.species} />}

        {/* Timeline teaser */}
        {isSignedIn && (
          <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 mb-8 max-w-2xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent flex-shrink-0 text-lg">📖</div>
              <div>
                <h3 className="font-heading text-lg text-brown mb-1">Your pet's wellness timeline</h3>
                <p className={cls.body + " text-sm mb-3"}>Every scan is saved to your account. Over time, you'll see patterns emerge — seasonal shifts, recurring observations, and progress markers that help you and your vet make informed decisions.</p>
                <button onClick={onAccount} className={cls.btnGhost + " text-xs !py-2 !px-4"}>View timeline <I.ArrowR /></button>
              </div>
            </div>
          </div>
        )}

        {/* AI Pet Coach — available on full scan too */}
        <div className="mt-8 mb-8">
          <ChatCoach
            reading={[
              innerviewText ? `EMOTIONAL VIEW READING:\n${innerviewText}` : "",
              `PHYSICAL WELLNESS OBSERVATION:\nStatus: ${r.overallStatus.replace(/_/g, " ")}\n\n${r.overallNote}`,
              ...r.areas.map((a) => `${a.area.toUpperCase()}: ${a.observation} (concern: ${a.concern})`),
            ].filter(Boolean).join("\n\n---\n\n")}
            petName={petName}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={() => {
            const dataUrl = generateShareCard(r, r.species, petName);
            if (dataUrl) {
              const a = document.createElement("a");
              a.href = dataUrl;
              a.download = `innerview-${r.species}-${Date.now()}.png`;
              a.click();
            }
          }} className={cls.btnPrimary + " text-sm sm:text-base !px-6 sm:!px-8 !py-3 sm:!py-4"}>📤 Share result</button>
          <button onClick={onNewScan} className={cls.btnSecondary + " text-sm sm:text-base !px-6 sm:!px-8 !py-3 sm:!py-4"}><I.Camera /> Scan another</button>
          <button onClick={onClose} className={cls.btnGhost + " text-sm sm:text-base !px-6 sm:!px-8 !py-3 sm:!py-4"}>Back to home</button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  ABOUT                                                       */
/* ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════ */
/*  SCIENCE / RESEARCH                                          */
/* ═══════════════════════════════════════════════════════════ */
function SciencePage({ onBack, onAbout, onScan, onSignin, onAccount, onSignOut, onAdmin }: { onBack: () => void; onAbout: () => void; onScan: () => void; onSignin: () => void; onAccount: () => void; onSignOut?: () => void; onAdmin?: () => void }) {
  const categories = [
    {
      label: "Pain Assessment",
      papers: [
        {
          title: "Facial expressions of pain in cats: the development and validation of a Feline Grimace Scale",
          authors: "Evangelista et al.",
          journal: "Scientific Reports (Nature), 2019",
          doi: "10.1038/s41598-019-55693-8",
          desc: "The foundational FGS study — 55 cats, 5 facial action units (ear position, orbital tightening, muzzle tension, whiskers change, head position). Inter-rater ICC 0.89, response to analgesia confirmed.",
        },
        {
          title: "Fully automated deep learning models with smartphone applicability for prediction of pain using the Feline Grimace Scale",
          authors: "Steagall et al.",
          journal: "Scientific Reports (Nature), 2023",
          doi: "10.1038/s41598-023-49031-2",
          desc: "3,447 cat face images, 37 landmarks. ShuffleNetV2 CNN + XGBoost achieved 95.5% accuracy predicting FGS pain scores. Designed for smartphone deployment.",
        },
        {
          title: "How facial expressions reveal acute pain in domestic animals with facial pain scales as a diagnostic tool",
          authors: "Mota-Rojas et al.",
          journal: "Frontiers in Veterinary Science, 2025",
          doi: "10.3389/fvets.2025.1546719",
          desc: "Comprehensive review of the neurobiological association between acute pain and facial expressions across companion and farm animals.",
        },
      ],
    },
    {
      label: "Emotion Recognition",
      papers: [
        {
          title: "Explainable automated recognition of emotional states from canine facial expressions: the case of positive anticipation and frustration",
          authors: "Boneh-Shitrit et al.",
          journal: "Scientific Reports (Nature), 2022",
          doi: "10.1038/s41598-022-27079-w",
          desc: "First controlled-experiment dataset of canine emotional facial expressions (29 Labradors). DogFACS-based decision tree achieved 71% accuracy; deep learning reached 89%.",
        },
        {
          title: "Dog facial landmarks detection and its applications for facial analysis",
          authors: "Martvel et al.",
          journal: "Scientific Reports (Nature), 2025",
          doi: "10.1038/s41598-025-07040-3",
          desc: "DogFLW dataset: 3,732 dog images with 46 facial landmarks grounded in DogFACS. Benchmarked landmark detection and demonstrated emotion classification + action unit recognition.",
        },
      ],
    },
    {
      label: "Physical Wellness & AI Screening",
      papers: [
        {
          title: "CNN-based diagnosis models for canine ulcerative keratitis",
          authors: "Kim et al.",
          journal: "Scientific Reports (Nature), 2019",
          doi: "10.1038/s41598-019-50437-0",
          desc: "ResNet, VGGNet and GoogLeNet trained on canine corneal photos. Over 90% accuracy classifying superficial vs deep ulcers.",
        },
        {
          title: "GREENIES™ Canine Dental Check — Mars Petcare AI screening",
          authors: "Mars Petcare",
          journal: "Mars Global product, 2025",
          doi: null,
          url: "https://www.mars.com/news-and-stories/press-releases-statements/mars-pet-health-artificial-intelligence-powered-tools",
          desc: "AI dental-scoring tool trained on a 53,000-image canine-teeth corpus. Snap a photo, get instant tartar and gum-irritation insights.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout} onScan={onScan} onSignin={onSignin} onAccount={onAccount} onSignOut={onSignOut} onAdmin={onAdmin} />
      <VetBanner />
      <main id="main" tabIndex={-1} className={cls.container + " py-12 lg:py-16"}>
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className={cls.labelAccent}>The Science Behind Emotional View</p>
            <h1 className={cls.h1 + " text-4xl lg:text-5xl mt-2 max-w-3xl"}>Peer-reviewed research that informs every scan.</h1>
          </div>
          <button onClick={onBack} aria-label="Close" className="text-coffeeText hover:text-brown touch-min p-2"><I.Close c="w-6 h-6" /></button>
        </div>

        <p className="font-body text-lg text-coffeeText leading-relaxed max-w-3xl mb-12">
          PetView is built on published veterinary and computer-vision research. Every observation our AI makes is grounded in validated frameworks — from the Feline Grimace Scale to DogFACS to peer-reviewed CNN screening models. Below is the complete bibliography.
        </p>

        {/* THE SCIENCE */}
        <section className="mb-16">
          <p className={cls.labelAccent + " mb-3"}>The science</p>
          <h2 className={cls.h2 + " text-3xl lg:text-4xl mb-6 max-w-3xl"}>
            What AI can read from a pet's face.<br />
            <span className="text-accent">Backed by published research.</span>
          </h2>
          <p className="font-body text-lg text-coffeeText max-w-3xl mb-10">
            Veterinarians and AI researchers have spent decades decoding what facial photos reveal about animal wellbeing. We built PetView on that foundation — not speculation.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {[
              {
                stat: "96%",
                label: "Pain detection accuracy",
                desc: "Deep learning models trained on the Feline Grimace Scale (FGS) distinguish painful from non-painful cats with up to 96% accuracy — using just facial photos.",
                cite: "Steagall et al., Scientific Reports 2023",
                link: "https://doi.org/10.1038/s41598-023-49031-2",
              },
              {
                stat: "89%",
                label: "Emotion classification",
                desc: "AI classifies canine emotional states — positive anticipation vs. frustration — from facial expressions at 89% accuracy, validated against DogFACS coding.",
                cite: "Boneh-Shitrit et al., Scientific Reports 2022",
                link: "https://doi.org/10.1038/s41598-022-27079-w",
              },
              {
                stat: "46",
                label: "Facial landmarks tracked",
                desc: "The DogFLW dataset maps 46 facial landmarks on dogs, enabling automated recognition of action units linked to stress, fear, and comfort.",
                cite: "Martvel et al., Scientific Reports 2025",
                link: "https://doi.org/10.1038/s41598-025-07040-3",
              },
              {
                stat: "5",
                label: "Grimace action units",
                desc: "The FGS measures five facial action units in cats: ear position, orbital tightening, muzzle tension, whisker position, and head posture — all visible in a single photo.",
                cite: "Evangelista et al., PLoS One 2019",
                link: "https://doi.org/10.1038/s41598-019-55693-8",
              },
              {
                stat: "21",
                label: "DogFACS action units",
                desc: "The Dog Facial Action Coding System identifies 21 independent facial and ear movements (action units + ear action descriptors) that objectively code canine expressions.",
                cite: "Caeiro et al., Behavioural Processes 2017",
                link: null,
              },
              {
                stat: "0–4",
                label: "Canine pain scale",
                desc: "The Colorado State University Canine Acute Pain Scale (CSU-CAPS) scores pain 0–4 using facial changes: droopy ears, arched eyebrows, and darting 'worried' eyes.",
                cite: "CSU Veterinary Teaching Hospital",
                link: null,
              },
              {
                stat: "90%+",
                label: "Corneal ulcer detection",
                desc: "CNN models (ResNet, VGGNet, GoogLeNet) trained on canine corneal photos achieve over 90% accuracy classifying superficial versus deep ulcers.",
                cite: "Kim et al., Scientific Reports 2019",
                link: "https://doi.org/10.1038/s41598-019-50437-0",
              },
              {
                stat: "53K",
                label: "Dental images trained",
                desc: "Mars Petcare's GREENIES AI dental-scoring tool was trained on 53,000 canine mouth photos — demonstrating the diagnostic yield of oral photography.",
                cite: "Mars Petcare, 2025",
                link: "https://www.mars.com/news-and-stories/press-releases-statements/mars-pet-health-artificial-intelligence-powered-tools",
              },
            ].map((s, i) => {
              const Card = (
                <div key={i} className={`bg-paper border border-coffee/20 rounded-2xl p-6 hover-lift ${s.link ? 'cursor-pointer' : ''}`}>
                  <p className="font-heading text-4xl text-accent leading-none mb-2">{s.stat}</p>
                  <p className="font-heading text-sm text-brown mb-3">{s.label}</p>
                  <p className={cls.body + " text-sm mb-4 flex-1"}>{s.desc}</p>
                  <p className="text-[10px] font-hero tracking-wider uppercase text-coffeeText/60">{s.cite}</p>
                </div>
              );
              return s.link ? (
                <a key={i} href={s.link} target="_blank" rel="noopener noreferrer" className="block no-underline">
                  {Card}
                </a>
              ) : Card;
            })}
          </div>

          <div className="bg-paper border border-coffee/30 rounded-2xl p-8 md:p-10">
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div>
                <p className={cls.labelAccent + " mb-3"}>What the research says</p>
                <h3 className={cls.h2 + " text-2xl md:text-3xl mb-4"}>A face is a data-rich surface.</h3>
                <p className="text-coffeeText leading-relaxed mb-4">
                  Facial expressions in animals are involuntary responses that communicate internal states. Scientists have validated this across species using standardized coding systems like DogFACS (21 action units) and the Feline Grimace Scale (5 action units).
                </p>
                <p className="text-coffeeText leading-relaxed">
                  What makes photos powerful: these cues are often invisible to the untrained eye, but detectable by AI trained on thousands of annotated images. Ear position shifts of millimeters. Subtle eye tension. Whisker retraction. All signal something.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Pain & discomfort", desc: "Flattened ears, squinted eyes, tense muzzle, retracted whiskers — validated grimace scales for cats (FGS) and dogs (CSU-CAPS)." },
                  { label: "Emotional states", desc: "Anticipation, frustration, fear, and calm are distinguishable through ear adduction, blinking, nose-licking, lips part, and jaw posture." },
                  { label: "Stress & anxiety", desc: "Rapid blinking, lip licking, ear flattening, and gaze aversion are documented stress indicators across breeds (DogFACS)." },
                  { label: "Dehydration & vitality", desc: "Dry nose, sunken eyes, pale or tacky gums — visible markers of hydration status and circulatory health." },
                  { label: "Eye conditions", desc: "Corneal cloudiness, discharge, third-eyelid prominence, and conjunctiva changes — CNN models achieve 90%+ accuracy on smartphone eye photos." },
                  { label: "Dental health", desc: "Tartar accumulation, gum color, tooth fractures, and oral inflammation — the highest-yield single screening area in companion animals." },
                ].map((item, i) => (
                  <div key={i} className="bg-soft rounded-xl p-4 border border-coffee/20">
                    <p className="font-heading text-sm text-brown mb-1">{item.label}</p>
                    <p className="text-xs text-coffeeText leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* INNERVIEW EMOTIONAL LAYER */}
        <section className="bg-paper border border-coffee/30 rounded-2xl p-8 md:p-12 mb-16">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div>
              <p className={cls.labelAccent + " mb-3"}>Emotional View</p>
              <h2 className={cls.h2 + " text-3xl lg:text-4xl mb-6"}>The emotional layer no other app offers.</h2>
              <p className="text-coffeeText leading-relaxed mb-6">
                Every pet scan includes Emotional View — a second reading of the same four photos through the lens of Traditional Chinese Medicine, Ayurveda, and bioenergetics. While the physical read observes the body, Emotional View translates the bond.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  { title: "Stress & pain signals", desc: "Ear position, blink rate, lip licking, and facial tension decoded through validated frameworks — what your pet may be communicating beneath the surface." },
                  { title: "Emotional tone", desc: "Dominant mood state across all four photos. Is your pet settled and present? Carrying low-level fatigue? The emotional impression reads what words can't." },
                  { title: "Actionable guidance", desc: "Not just observation — gentle, practical suggestions you can act on today. More quiet connection. Less guesswork." },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-accent font-heading text-sm">{i + 1}</span>
                    </div>
                    <div>
                      <h3 className="font-heading text-sm text-brown mb-1">{item.title}</h3>
                      <p className="text-xs text-coffeeText leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-xs font-hero tracking-[0.22em] uppercase text-accent">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden /> Included with every scan
              </div>
            </div>
            <div className="bg-soft border border-coffee/20 rounded-2xl p-8">
              <div className="space-y-4">
                <p className="font-heading text-lg text-brown mb-1">What Emotional View reads</p>
                <p className="text-[11px] text-coffeeText/70 leading-relaxed mb-4 italic">Traditional observational frameworks — educational, not diagnostic or medical.</p>
                {[
                  { framework: "TCM", reads: "Shen (spirit presence) via eye brightness · Lung energy via nose moisture · Spleen/Heart via facial expression" },
                  { framework: "Ayurveda", reads: "Prana (vitality) via eye clarity · Vata balance via dryness/sensitivity · Dosha impression via overall facial tone" },
                  { framework: "Bioenergetics", reads: "Jaw and facial holding patterns · Energy flow through facial meridians · Subtle tension vs. ease signals" },
                  { framework: "DogFACS / FGS", reads: "Ear adduction (stress) · Orbital tightening (pain) · Lip licking (anxiety) · Whisker retraction (discomfort)" },
                ].map((row, i) => (
                  <div key={i} className="pb-4 border-b border-coffee/20 last:border-0 last:pb-0">
                    <p className="font-hero text-[10px] tracking-[0.22em] uppercase text-accent mb-1">{row.framework}</p>
                    <p className="text-xs text-coffeeText leading-relaxed">{row.reads}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-coffeeText/70 italic mt-8 pt-6 border-t border-coffee/20 leading-relaxed">
            Emotional View is an educational observation tool. Traditional frameworks (TCM, Ayurveda, bioenergetics) are not FDA-recognized diagnostic systems. Always consult a licensed veterinarian for medical concerns.
          </p>
        </section>

        <div className="mb-10">
          <p className={cls.labelAccent + " mb-3"}>Published research</p>
          <h2 className={cls.h2 + " text-3xl lg:text-4xl mb-3 max-w-3xl"}>The bibliography behind every reading.</h2>
          <p className="font-body text-base text-coffeeText max-w-3xl">Every observation our AI makes is anchored in published, peer-reviewed work. Click any title to read the source.</p>
        </div>

        <div className="space-y-16">
          {categories.map((cat) => (
            <section key={cat.label}>
              <p className={cls.labelAccent + " mb-6"}>{cat.label}</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {cat.papers.map((p) => (
                  <a
                    key={p.title}
                    href={p.doi ? `https://doi.org/${p.doi}` : p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-paper border border-coffee/30 rounded-2xl p-6 hover:border-accent/40 transition-colors h-full flex flex-col"
                  >
                    <h3 className="font-heading font-medium text-brown mb-2 leading-snug">{p.title}</h3>
                    <p className="text-xs font-hero tracking-wider uppercase text-accent mb-3">{p.journal}</p>
                    <p className={cls.body + " text-sm mb-4 flex-1"}>{p.desc}</p>
                    <span className="inline-flex items-center gap-1.5 text-xs font-heading text-accent hover:text-brown transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Read article
                    </span>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-10 border-t border-coffee/20">
          <p className={cls.body + " text-sm text-coffeeText"}>
            All articles are independently verified and linked via DOI (Digital Object Identifier) — the most persistent citation standard in scholarly publishing. If a link ever fails, the DOI will always resolve to the current publisher location.
          </p>
        </div>

        <button onClick={onBack} className={cls.btnPrimary + " text-sm !px-6 !py-3 mt-10"}>Back to PetView</button>
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  ADMIN                                                       */
/* ═══════════════════════════════════════════════════════════ */
function AdminPage({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const [token, setToken] = useState(() => localStorage.getItem("pv_admin_token") ?? "");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [grantCount, setGrantCount] = useState(1);
  const [grantNote, setGrantNote] = useState("");
  const [grantMsg, setGrantMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [directEmail, setDirectEmail] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const search = trpc.admin.searchUsers.useQuery(
    { query: searchQuery.trim(), token },
    { enabled: authed && hasSearched }
  );
  const user = trpc.admin.getUser.useQuery(
    { email: selectedEmail ?? "", token },
    { enabled: authed && Boolean(selectedEmail) }
  );
  const grant = trpc.admin.grantCredits.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setGrantMsg({ ok: true, text: `${grantCount} credit${grantCount === 1 ? "" : "s"} granted. User now has ${data.remaining} total.` });
        setGrantCount(1);
        setGrantNote("");
        user.refetch();
        search.refetch();
      } else {
        setGrantMsg({ ok: false, text: data.error ?? "Failed to grant credits." });
      }
    },
    onError: (err) => {
      setGrantMsg({ ok: false, text: err.message || "Failed to grant credits." });
    },
  });

  const doAuth = async () => {
    if (!token.trim()) return;
    setAuthError(null);
    setAuthChecking(true);
    try {
      const res = await utils.client.admin.verify.query({ token: token.trim() });
      if (res.ok) {
        localStorage.setItem("pv_admin_token", token.trim());
        setAuthed(true);
      } else {
        setAuthError("That admin token doesn't match. Check ADMIN_TOKEN in your Railway env vars.");
        localStorage.removeItem("pv_admin_token");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unable to verify token. Check your network.";
      setAuthError(msg);
    } finally {
      setAuthChecking(false);
    }
  };

  const doDirectGrant = (e: React.FormEvent) => {
    e.preventDefault();
    const email = directEmail.trim();
    if (!email || grantCount < 1) return;
    setGrantMsg(null);
    grant.mutate({ email, credits: grantCount, note: grantNote || undefined, token });
  };

  const doSearch = () => {
    const q = inputValue.trim();
    setSearchQuery(q);
    setSelectedEmail(null);
    setHasSearched(true);
  };

  const doShowAll = () => {
    setInputValue("");
    setSearchQuery("");
    setSelectedEmail(null);
    setHasSearched(true);
  };

  const doGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail || grantCount < 1) return;
    setGrantMsg(null);
    grant.mutate({ email: selectedEmail, credits: grantCount, note: grantNote || undefined, token });
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center px-6">
        <div className="bg-paper border border-coffee/30 rounded-2xl p-8 max-w-md w-full">
          <h2 className={cls.h2 + " text-2xl mb-4"}>PetView Admin</h2>
          <p className={cls.body + " text-sm mb-6"}>Enter your admin token to access the backoffice.</p>
          <input
            type="password"
            value={token}
            onChange={(e) => { setToken(e.target.value); setAuthError(null); }}
            placeholder="Admin token"
            className="w-full px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown focus:border-accent focus:outline-none mb-4"
            onKeyDown={(e) => e.key === "Enter" && !authChecking && doAuth()}
            disabled={authChecking}
          />
          {authError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-red-800">{authError}</p>
            </div>
          )}
          <button
            onClick={doAuth}
            disabled={authChecking || !token.trim()}
            className={cls.btnPrimary + " w-full disabled:opacity-50"}
          >{authChecking ? "Verifying…" : "Enter"}</button>
          <button onClick={onClose} className={cls.btnGhost + " w-full justify-center mt-4"}>Back to home</button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-soft">
      <div className={cls.container + " py-8 lg:py-12"}>
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <p className={cls.labelAccent}>Backoffice</p>
            <h1 className={cls.h1 + " text-3xl lg:text-4xl mt-2"}>Admin</h1>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-coffeeText hover:text-brown touch-min p-2"><I.Close c="w-6 h-6" /></button>
        </div>

        {/* Search */}
        <div className="bg-paper border border-coffee/30 rounded-2xl p-6 mb-8 max-w-xl">
          <p className={cls.labelAccent + " mb-3"}>Find User</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search by email..."
              className="flex-1 px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown focus:border-accent focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
            />
            <button onClick={doSearch} className={cls.btnPrimary + " !px-5"}>Search</button>
          </div>
          <button onClick={doShowAll} className={cls.btnGhost + " mt-3 text-xs"}>Show all accounts</button>

          {search.isLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-coffeeText">
              <span className="inline-block w-4 h-4 border-2 border-coffee/20 border-t-accent rounded-full animate-spin" />
              Searching…
            </div>
          )}
          {search.isError && <p className="text-sm text-destructive mt-4">Search failed. Check connection or token.</p>}
          {hasSearched && !search.isLoading && search.data?.success && search.data.users.length === 0 && (
            <div className="mt-4 bg-coffeeLight rounded-xl p-4">
              <p className="text-sm text-brown">No users found for "{searchQuery}".</p>
            </div>
          )}
          {search.data?.success && search.data.users.length > 0 && (
            <ul className="mt-4 space-y-2">
              {search.data.users.map((u) => (
                <li key={u.email}>
                  <button
                    onClick={() => setSelectedEmail(u.email)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${selectedEmail === u.email ? "border-accent bg-accent/5" : "border-coffee/20 hover:bg-coffeeLight"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-body text-brown text-sm">{u.email}</span>
                      <span className="text-xs text-coffeeText">
                        {u.hasUnlimited ? "Unlimited" : `${u.remainingCredits} credit${u.remainingCredits === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Direct grant — bypasses search; works even when no accounts row exists */}
        <div className="bg-paper border border-coffee/30 rounded-2xl p-6 mb-8 max-w-xl">
          <p className={cls.labelAccent + " mb-3"}>Direct grant (skip search)</p>
          <p className="text-xs text-coffeeText mb-4">Use this to grant credits to an email even if it doesn't appear in search. The account row is created automatically on grant.</p>
          <form onSubmit={doDirectGrant} className="space-y-3">
            <input
              type="email"
              value={directEmail}
              onChange={(e) => setDirectEmail(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown focus:border-accent focus:outline-none"
              required
            />
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={1000}
                value={grantCount}
                onChange={(e) => setGrantCount(parseInt(e.target.value) || 1)}
                className="w-24 px-3 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                placeholder="Note (optional)"
                className="flex-1 px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown focus:border-accent focus:outline-none"
              />
            </div>
            <button type="submit" disabled={grant.isPending || !directEmail.trim()} className={cls.btnPrimary + " w-full disabled:opacity-50"}>
              {grant.isPending ? "Granting…" : `Grant ${grantCount} credit${grantCount === 1 ? "" : "s"}`}
            </button>
            {grantMsg && !selectedEmail && (
              <p className={`text-sm mt-2 ${grantMsg.ok ? "text-green-700" : "text-red-700"}`}>{grantMsg.text}</p>
            )}
          </form>
        </div>

        {/* User detail */}
        {selectedEmail && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="bg-paper border border-coffee/30 rounded-2xl p-6">
                <p className={cls.labelAccent + " mb-3"}>User Overview</p>
                {user.isLoading && <p className="text-sm text-coffeeText">Loading user…</p>}
                {user.isError && <p className="text-sm text-destructive">Failed to load user.</p>}
                {user.data?.success && (
                  <>
                    <p className="font-body text-brown mb-1"><strong>Email:</strong> {user.data.user.email}</p>
                    <p className="font-body text-brown mb-1"><strong>Credits:</strong> {user.data.user.hasUnlimited ? "∞ Unlimited" : user.data.user.totalCredits}</p>
                    <p className="font-body text-brown mb-1"><strong>Scans:</strong> {user.data.user.scanCount}</p>
                    {user.data.user.hasUnlimited && user.data.user.unlimitedUntil && (
                      <p className="font-body text-brown mb-1"><strong>Renews:</strong> {new Date(user.data.user.unlimitedUntil).toLocaleDateString()}</p>
                    )}
                  </>
                )}
              </div>

              {user.data?.success && (
                <div className="bg-paper border border-coffee/30 rounded-2xl p-6">
                  <p className={cls.labelAccent + " mb-3"}>Grant Free Credits</p>
                  <form onSubmit={doGrant} className="space-y-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={grantCount}
                      onChange={(e) => setGrantCount(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown focus:border-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={grantNote}
                      onChange={(e) => setGrantNote(e.target.value)}
                      placeholder="Note (optional) — e.g. 'Refund for error on 5/17'"
                      className="w-full px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown focus:border-accent focus:outline-none"
                    />
                    <button type="submit" disabled={grant.isPending} className={cls.btnPrimary + " w-full disabled:opacity-60"}>
                      {grant.isPending ? "Granting…" : `Grant ${grantCount} credit${grantCount === 1 ? "" : "s"}`}
                    </button>
                  </form>
                  {grantMsg && (
                    <p className={`text-sm mt-3 ${grantMsg.ok ? "text-green-700" : "text-destructive"}`}>{grantMsg.text}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-6">
              {user.data?.success && (
                <div className="bg-paper border border-coffee/30 rounded-2xl p-6">
                  <p className={cls.labelAccent + " mb-3"}>Credit Packs</p>
                  {user.data.user.credits.length === 0 ? (
                    <p className="text-sm text-coffeeText">No credit packs.</p>
                  ) : (
                    <ul className="space-y-2">
                      {user.data.user.credits.map((c) => (
                        <li key={c.id} className="text-sm border-b border-coffee/10 pb-2 last:border-0">
                          <div className="flex justify-between">
                            <span className="font-body text-brown">{c.source}</span>
                            <span className="text-coffeeText">
                              {c.remaining != null ? `${c.remaining} / ${c.creditsTotal} left` : c.subscriptionStatus ?? "—"}
                            </span>
                          </div>
                          {c.note && <p className="text-xs text-coffeeText mt-0.5">{c.note}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {user.data?.success && (
                <div className="bg-paper border border-coffee/30 rounded-2xl p-6">
                  <p className={cls.labelAccent + " mb-3"}>Recent Scans</p>
                  {user.data.user.scans.length === 0 ? (
                    <p className="text-sm text-coffeeText">No scans yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {user.data.user.scans.map((s) => (
                        <li key={s.id} className="text-sm border-b border-coffee/10 pb-2 last:border-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-heading text-brown">{s.wellnessScore ?? "—"}/100</span>
                            <span className="text-xs text-coffeeText">
                              {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          <p className="text-coffeeText mt-0.5 line-clamp-2">{s.summary || "No summary."}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AboutPage({ onBack }: { onBack: () => void }) {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "Do I need to create an account or enter a card to try it?",
      a: (
        <p>No. Every device gets one free scan up front — no sign-up, no card. When you want another scan or unlimited access, sign in with your email (no password) and your scan history follows you.</p>
      ),
    },
    {
      q: "Can I cancel my subscription anytime?",
      a: (
        <>
          <p className="mb-2">Yes. The <strong className="text-brown">Manage subscription</strong> button on your Account page opens the Stripe Customer Portal — pause, cancel, update your card, or download invoices in one place.</p>
          <p>Cancellation takes effect at the end of your current billing period; you keep access through the date you've already paid for.</p>
        </>
      ),
    },
    {
      q: "Do you offer refunds?",
      a: (
        <>
          <p className="mb-2"><strong className="text-brown">Unlimited (monthly or annual):</strong> 14-day money-back guarantee from your first paid charge.</p>
          <p className="mb-2"><strong className="text-brown">Scan packs:</strong> unused credits are refundable within 14 days. Scans you've already run aren't refundable — each scan triggers a paid AI analysis the moment you submit (the Wellness Scan runs four analyses per scan, one per area).</p>
          <p>Email <a href="mailto:info@solivana.com" className="text-accent hover:underline">info@solivana.com</a> from the email you bought with. Full policy at <a href="https://tools.solivana.io/refund" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">tools.solivana.io/refund</a>.</p>
        </>
      ),
    },
    {
      q: "Can I switch plans later?",
      a: (
        <p>Yes. Open the Customer Portal from your Account page and upgrade or downgrade anytime — Stripe handles proration automatically, so you're only billed for the difference.</p>
      ),
    },
    {
      q: "What happens to my pet's photos?",
      a: (
        <>
          <p className="mb-2">The four close-up photos (nose, eyes, ears, mouth) are sent to SoliVana's AI vision system for analysis and aren't retained as permanent images on our servers. The reading itself stays tied to your email so you can revisit it.</p>
          <p>Full detail in our <a href="https://tools.solivana.io/privacy#ai" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Privacy Policy</a>.</p>
        </>
      ),
    },
    {
      q: "Is this veterinary advice?",
      a: (
        <p>No. PetView is a screening tool — observational AI that describes what's visible in plain English and flags anything concerning. It is not a diagnosis and does not replace your veterinarian. Anything flagged is a prompt to book a vet visit, not a decision to act on alone.</p>
      ),
    },
  ];

  const papers = [
    { title: "CNN-based diagnosis models for canine ulcerative keratitis",         journal: "Scientific Reports (Nature) 2019", desc: "Kim et al. (Konkuk University) — ResNet, VGGNet and GoogLeNet trained on canine corneal photos. Over 90% accuracy classifying superficial vs deep ulcers — published in Nature Scientific Reports.",                                  url: "https://doi.org/10.1038/s41598-019-50437-0" },
    { title: "The Feline Grimace Scale: development and validation",                journal: "Scientific Reports (Nature) 2019", desc: "Evangelista et al. (Université de Montréal) — 55 cats, 5 facial action units (ear position, orbital tightening, muzzle tension, whiskers change, head position). Inter-rater ICC 0.89, response to analgesia confirmed.",        url: "https://doi.org/10.1038/s41598-019-55693-8" },
    { title: "Fully automated deep-learning FGS with smartphone applicability",     journal: "Scientific Reports (Nature) 2023", desc: "Steagall et al. — 3,447 cat face images, 37 landmarks. ShuffleNetV2 CNN + XGBoost achieved 95.5% accuracy predicting FGS pain scores. Designed for smartphone deployment.",                                                          url: "https://doi.org/10.1038/s41598-023-49031-2" },
    { title: "Explainable automated recognition of emotional states from canine facial expressions", journal: "Scientific Reports (Nature) 2022", desc: "Boneh-Shitrit et al. — First controlled-experiment dataset of canine emotional facial expressions (29 Labradors). DogFACS-based decision tree achieved 71% accuracy; deep learning reached 89% for positive anticipation vs. frustration.", url: "https://doi.org/10.1038/s41598-022-27079-w" },
    { title: "Dog facial landmarks detection and its applications for facial analysis", journal: "Scientific Reports (Nature) 2025", desc: "Martvel et al. — DogFLW dataset: 3,732 dog images with 46 facial landmarks grounded in DogFACS. Benchmarked landmark detection and demonstrated emotion classification + action unit recognition pipelines.",                        url: "https://doi.org/10.1038/s41598-025-07040-3" },
    { title: "How facial expressions reveal acute pain in domestic animals with facial pain scales", journal: "Frontiers in Veterinary Science 2025", desc: "Comprehensive review of neurobiological association between acute pain and facial expressions in companion animals. Covers FGS, CSU-CAPS, and grimace-scale validation across species.",                                            url: "https://doi.org/10.3389/fvets.2025.1546719" },
    { title: "GREENIES™ Canine Dental Check — Mars Petcare AI screening",            journal: "Mars Global product, 2025",        desc: "AI dental-scoring tool from Mars Petcare's veterinary AI program — trained on a 53,000-image canine-teeth corpus, deployed via the Mars Petcare ecosystem.",                                                                                  url: "https://www.mars.com/news-and-stories/press-releases-statements/mars-pet-health-artificial-intelligence-powered-tools" },
  ];
  const stories = [
    { quote: "PetView caught the third eyelid showing on my senior lab before I would have. The vet confirmed early conjunctivitis — caught it days earlier than we would have on our own.", attribution: "Marie D., Labrador owner · Oakland" },
    { quote: "I scan my cat once a week. Her gum-color reading was the first thing that told me something was off — turned out to be early dental disease.", attribution: "Jared P., cat dad · Austin" },
    { quote: "Twenty rescues a year — we use PetView at intake. It's not a vet, but it's a consistent first look across every animal, and that's huge for a small foster network.", attribution: "Beth M., rescue coordinator" },
  ];
  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={() => {}} onScan={onBack} />
      <VetBanner />
      <main id="main" tabIndex={-1} className={cls.container + " py-12 lg:py-16"}>
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className={cls.labelAccent}>About PetView</p>
            <h1 className={cls.h1 + " text-4xl lg:text-5xl mt-2 max-w-3xl"}>The first app that reads what your pet is feeling.</h1>
          </div>
          <button onClick={onBack} aria-label="Close" className="text-coffeeText hover:text-brown touch-min p-2"><I.Close c="w-6 h-6" /></button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <p className="font-body text-lg text-coffeeText leading-relaxed mb-6">
              PetView reads your pet through two lenses: peer-reviewed veterinary science
              and traditional wellness frameworks. Our AI is informed by the Feline Grimace Scale,
              DogFACS, and published research from <em>Scientific Reports</em>, <em>Frontiers</em>,
              and <em>Nature</em> — combined with TCM, Ayurveda, and bioenergetics.
              <strong className="text-brown"> Emotional View</strong> translates what your pet's facial
              expression, eyes, ears, nose, and mouth may reflect about their emotional state,
              stress level, and comfort.
              <strong className="text-brown"> Physical Wellness Observation</strong> evaluates
              visible health markers through the same integrated lens. No other app does both.
            </p>
            <p className={cls.body + " mb-6"}>
              We describe what we see in plain English and flag anything worth bringing to your
              veterinarian. Never a diagnosis. Always a starting point — grounded in research
              that has decoded animal facial expressions, and in frameworks that have observed
              the body-mind connection for thousands of years.
            </p>

            <h2 className="font-heading text-2xl text-brown mb-4 mt-10">Selected research</h2>
            <p className={cls.body + " text-sm mb-6"}>Peer-reviewed and industry work on AI-assisted visual veterinary screening that informs how we approach the reading. Each link verified.</p>
            <ul className="space-y-3">
              {papers.map((p) => (
                <li key={p.url}>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="block bg-paper border border-coffee/30 rounded-2xl p-5 hover:border-accent/40 transition-colors">
                    <h3 className="font-heading font-medium text-brown mb-1">{p.title}</h3>
                    <p className="text-xs font-hero tracking-wider uppercase text-accent mb-2">{p.journal}</p>
                    <p className={cls.body + " text-sm"}>{p.desc}</p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <aside className="lg:col-span-1">
            <div className="bg-paper border border-coffee/30 rounded-2xl p-6 sticky top-28">
              <p className={cls.labelAccent + " mb-4"}>From early users</p>
              <ul className="space-y-5">
                {stories.map((s, i) => (
                  <li key={i}>
                    <p className={cls.body + " text-sm italic mb-2 text-brown"}>"{s.quote}"</p>
                    <p className="text-xs font-hero tracking-[0.18em] uppercase text-coffeeText">— {s.attribution}</p>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] font-hero tracking-[0.18em] uppercase text-coffeeText/80 mt-6 pt-4 border-t border-coffee/20">Composite from early-user feedback. Individual results vary.</p>
            </div>
          </aside>
        </div>

        <section aria-labelledby="faq-heading" className="mt-4 mb-12 pt-12 border-t border-coffee/20">
          <p className={cls.labelAccent}>Common questions</p>
          <h2 id="faq-heading" className={cls.h1 + " text-3xl lg:text-4xl mt-2 mb-8 max-w-2xl"}>Things people ask</h2>
          <ul className="space-y-3 max-w-3xl">
            {faqs.map((f, i) => (
              <li key={i}>
                <details className="group bg-paper border border-coffee/30 rounded-2xl px-6 py-4 open:border-accent/40 transition-colors">
                  <summary className="font-heading text-brown text-base cursor-pointer list-none flex items-center justify-between gap-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper rounded">
                    <span>{f.q}</span>
                    <span aria-hidden="true" className="text-accent text-lg leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
                  </summary>
                  <div className={cls.body + " text-sm mt-4 leading-relaxed"}>{f.a}</div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <button onClick={onBack} className={cls.btnPrimary + " text-sm !px-6 !py-3"}>Back to PetView</button>
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  SIGN-IN                                                     */
/* ═══════════════════════════════════════════════════════════ */
function SigninScreen({ onClose, errorMsg }: { onClose: () => void; errorMsg?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const requestLink = trpc.auth.requestLink.useMutation();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try { await requestLink.mutateAsync({ email: email.trim() }); setSent(true); } catch {}
  };
  return (
    <div className="min-h-screen bg-soft flex items-center justify-center px-6">
      <div className="bg-paper border border-coffee/30 rounded-2xl p-8 max-w-md w-full">
        <button onClick={onClose} aria-label="Close" className="float-right text-coffeeText hover:text-brown touch-min p-2 -mt-2 -mr-2"><I.Close c="w-5 h-5" /></button>
        {sent ? (
          <>
            <div className="w-12 h-12 rounded-full bg-accent/15 mx-auto mb-4 flex items-center justify-center text-accent"><I.Check c="w-6 h-6" /></div>
            <h2 className="font-heading text-2xl text-brown mb-2 text-center">Check your inbox</h2>
            <p className={cls.body + " text-center mb-6"}>We sent a sign-in link to <strong className="text-brown">{email}</strong>. Click it to continue. The link is good for 24 hours.</p>
            <p className="text-xs text-brown text-center">Don't see it? Check your spam folder. The sender is <em>info@solivana.com</em>.</p>
          </>
        ) : (
          <>
            <p className={cls.labelAccent + " mb-2"}>Continue your scan</p>
            <h2 className="font-heading text-2xl text-brown mb-3">Enter your email to continue.</h2>
            {errorMsg && (
              <div role="alert" className="mb-5 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm text-brown">
                {errorMsg}
              </div>
            )}
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 mb-5">
              <p className="text-xs font-hero tracking-wider uppercase text-accent mb-2">Why sign in?</p>
              <ul className="space-y-1.5">
                <li className="flex items-start gap-2 text-sm text-brown"><I.Check c="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" /><span>Save every reading to your personal wellness timeline</span></li>
                <li className="flex items-start gap-2 text-sm text-brown"><I.Check c="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" /><span>Access your scans on any device — not just this one</span></li>
                <li className="flex items-start gap-2 text-sm text-brown"><I.Check c="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" /><span>Purchase packs or unlimited access with one click</span></li>
                <li className="flex items-start gap-2 text-sm text-brown"><I.Check c="w-3.5 h-3.5 mt-0.5 text-accent flex-shrink-0" /><span>No password — just a magic link to your inbox</span></li>
              </ul>
            </div>
            <p className={cls.body + " text-sm mb-6"}>We'll email you a one-tap sign-in link. No password to remember. Your purchased scans + reading history stay tied to your email.</p>
            <form onSubmit={handleSubmit}>
              <label className="block text-xs font-hero tracking-wider uppercase text-coffeeText mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@example.com" className="w-full px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown focus:border-accent focus:outline-none mb-5" />
              <button type="submit" disabled={requestLink.isPending || !email.trim()} className={cls.btnPrimary + " w-full !py-4 disabled:opacity-60"}>
                {requestLink.isPending ? "Sending…" : "Email me a link"} <I.ArrowR />
              </button>
            </form>
            <p className="text-xs text-brown mt-4 text-center">By continuing you agree to our <a href="https://tools.solivana.io/terms" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Terms</a> and <a href="https://tools.solivana.io/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Privacy Policy</a>.</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  AUTH                                                        */
/* ═══════════════════════════════════════════════════════════ */
function AuthPage({ onSignedIn, onError }: { onSignedIn: () => void; onError: (msg: string) => void }) {
  // Capture token ONCE at mount. We replaceState("/") on success, which would
  // otherwise blank the regex match on the next render and re-fire the effect.
  const [token] = useState(() => {
    const pathMatch = window.location.pathname.match(/^\/auth\/(.+)$/);
    const queryToken = new URLSearchParams(window.location.search).get("token");
    return pathMatch ? decodeURIComponent(pathMatch[1]) : (queryToken ?? "");
  });
  const exchange = trpc.auth.exchangeToken.useMutation();
  const [done, setDone] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!token) { onError("This sign-in link is missing a token."); return; }
    exchange.mutateAsync({ token }).then((res) => {
      if (!mounted.current) return;
      if (res.ok) {
        setSessionToken(res.sessionToken);
        setDone(true);
        window.history.replaceState({}, "", "/");
        setTimeout(() => { if (mounted.current) onSignedIn(); }, 600);
      } else {
        onError(res.reason === "expired" ? "This sign-in link expired. Request a new one." : res.reason === "already_used" ? "This link was already used. Request a new one." : "This sign-in link isn't valid. Request a new one.");
      }
    }).catch(() => { if (mounted.current) onError("Sign-in failed. Please try again."); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return (
    <div className="min-h-screen bg-soft flex items-center justify-center px-6">
      <div className="bg-paper border border-coffee/30 rounded-2xl p-8 max-w-md w-full text-center">
        {done ? (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center text-green-700"><I.Check c="w-6 h-6" /></div>
            <h2 className="font-heading text-xl text-brown mb-2">Signed in</h2>
            <p className={cls.body}>Taking you back to PetView…</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-coffeeLight mx-auto mb-4 flex items-center justify-center"><div className="h-1 w-6 shimmer-bar rounded-full" /></div>
            <h2 className="font-heading text-xl text-brown mb-2">Signing you in…</h2>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  ACCOUNT                                                     */
/* ═══════════════════════════════════════════════════════════ */
/* ─── Emotional View Emotion Timeline ─── */
function InnerViewTimeline() {
  const sessionToken = getSessionToken();
  const history = trpc.auth.history.useQuery({ sessionToken: sessionToken ?? "", limit: 20 }, { enabled: Boolean(sessionToken) });
  const [localEntries, setLocalEntries] = useState<{date: string; emotion: string; confidence: number; species: string}[]>([]);

  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem("petview_innerview_timeline") || "[]");
      setLocalEntries(data);
    } catch { setLocalEntries([]); }
  }, []);

  const dbEntries = (history.data?.scans || [])
    .filter((s: any) => s.scanMode === "innerview")
    .map((s: any) => {
      const analysis = s.fullAnalysis || {};
      return {
        date: s.createdAt,
        emotion: analysis.emotion?.dominantEmotion || "Neutral",
        confidence: analysis.emotion?.confidence || 60,
        species: "pet",
      };
    });

  const entries = dbEntries.length > 0 ? dbEntries : localEntries;
  if (entries.length === 0) return null;

  const emotionColors: Record<string, string> = { Happy: "#8FAE8F", Sad: "#6B8BA4", Anxious: "#D4A574", Relaxed: "#9BB89B", Alert: "#C9A96E", "In Pain": "#C4847A", Neutral: "#A09890" };
  const emotionIcons: Record<string, string> = { Happy: "😊", Sad: "😔", Anxious: "😰", Relaxed: "😌", Alert: "👀", "In Pain": "🚨", Neutral: "😐" };

  return (
    <div className="bg-paper border border-coffee/30 rounded-2xl p-6 mb-10">
      <p className={cls.labelAccent + " mb-4"}>Emotional Wellness Timeline</p>
      <div className="space-y-3">
        {entries.slice(0, 10).map((entry, i) => (
          <div key={i} className="flex items-center gap-4 pb-3 border-b border-coffee/10 last:border-0 last:pb-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: (emotionColors[entry.emotion] || "#D4A574") + "20" }}>
              {emotionIcons[entry.emotion] || "•"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-sm text-brown">{entry.emotion} <span className="text-coffeeText font-normal">· {entry.species}</span></p>
              <p className="text-xs text-coffeeText">{new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div className="flex-shrink-0">
              <ConfidenceBadge score={entry.confidence} />
            </div>
          </div>
        ))}
      </div>
      {entries.length > 10 && <p className="text-xs text-coffeeText mt-3 text-center">+ {entries.length - 10} more readings</p>}
    </div>
  );
}

function AccountPage({ onClose, onSignedOut, onUpgrade, onAbout, onSignOut }: { onClose: () => void; onSignedOut: () => void; onUpgrade: () => void; onAbout?: () => void; onSignOut?: () => void }) {
  const sessionToken = getSessionToken();
  const status = trpc.access.myStatus.useQuery({ sessionToken });
  const history = trpc.auth.history.useQuery({ sessionToken: sessionToken ?? "", limit: 20 }, { enabled: Boolean(sessionToken) });
  const signOut = trpc.auth.signOut.useMutation();
  const redeem = trpc.auth.redeemPromo.useMutation();
  const openPortal = trpc.auth.openBillingPortal.useMutation();
  const utils = trpc.useUtils();
  const [code, setCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [portalErr, setPortalErr] = useState<string | null>(null);

  const manageSubscription = async () => {
    if (!sessionToken) return;
    setPortalErr(null);
    try {
      const result = await openPortal.mutateAsync({ sessionToken, returnUrl: window.location.origin + "/account" });
      if (result.ok) {
        window.location.href = result.url;
      } else {
        const msgs: Record<string, string> = {
          stripe_unconfigured: "Billing portal isn't available right now.",
          not_signed_in: "Please sign in again.",
          no_subscription: "No subscription found on this account.",
          stripe_lookup_failed: "Couldn't reach Stripe — try again in a moment.",
          no_customer: "Couldn't locate the Stripe customer for this subscription.",
          portal_create_failed: "Billing portal couldn't be opened. Email info@solivana.com.",
        };
        setPortalErr(msgs[result.reason] ?? "Couldn't open the billing portal.");
      }
    } catch {
      setPortalErr("Couldn't reach the billing portal. Try again in a moment.");
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !code.trim()) return;
    setRedeemMsg(null);
    try {
      const result = await redeem.mutateAsync({ sessionToken, code: code.trim() });
      if (result.ok) {
        setRedeemMsg({ ok: true, text: `${result.creditsGranted} scan${result.creditsGranted === 1 ? "" : "s"} added.` });
        setCode("");
        utils.access.myStatus.invalidate();
      } else {
        const msgs: Record<string, string> = {
          invalid_code: "Code not found.",
          disabled: "Code is no longer active.",
          expired: "Code expired.",
          exhausted: "Code is fully redeemed.",
          already_redeemed: "You've already used this code.",
          not_signed_in: "Please sign in first.",
        };
        setRedeemMsg({ ok: false, text: msgs[result.reason] ?? "Couldn't redeem." });
      }
    } catch {
      setRedeemMsg({ ok: false, text: "Couldn't redeem. Please try again." });
    }
  };
  const doSignOut = async () => {
    if (sessionToken) await signOut.mutateAsync({ sessionToken }).catch(() => {});
    clearSessionToken();
    onSignedOut();
  };
  if (!status.data?.signedIn) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center px-6">
        <div className="bg-paper border border-coffee/30 rounded-2xl p-8 max-w-md w-full text-center">
          <h2 className="font-heading text-xl text-brown mb-3">Not signed in</h2>
          <button onClick={onClose} className={cls.btnPrimary}>Back</button>
        </div>
      </div>
    );
  }
  const s = status.data;
  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout ?? (() => {})} onScan={onClose} onAccount={() => {}} onSignOut={onSignOut} />
      <VetBanner />
      <main id="main" tabIndex={-1} className={cls.container + " py-12 lg:py-16"}>
        <div className="flex items-start justify-between mb-10 gap-4">
          <div>
            <p className={cls.labelAccent}>Your Account</p>
            <h1 className={cls.h1 + " text-4xl lg:text-5xl mt-2"}>{s.email}</h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={doSignOut} className={cls.btnSecondary + " !px-4 !py-2 text-xs"} aria-label="Sign out of this account">Sign out</button>
            <button onClick={onClose} aria-label="Close" className="text-coffeeText hover:text-brown touch-min p-2"><I.Close c="w-6 h-6" /></button>
          </div>
        </div>
        {/* Wellness timeline teaser */}
        <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent flex-shrink-0 text-lg">📖</div>
            <div>
              <h3 className="font-heading text-lg text-brown mb-1">Wellness Timeline</h3>
              <p className={cls.body + " text-sm"}>Each scan builds a picture of your pet's wellness journey. Patterns emerge over time — seasonal shifts, recurring observations, and moments of improvement. Share with your vet for richer conversations.</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          <div className="bg-paper border border-coffee/30 rounded-2xl p-6">
            <p className={cls.labelAccent + " mb-2"}>Scans Available</p>
            <p className="font-hero text-5xl text-accent leading-none mb-2">{s.hasUnlimited ? "∞" : s.totalCredits}</p>
            <p className="text-sm text-coffeeText">{s.hasUnlimited ? "Unlimited subscription active" : s.totalCredits === 0 ? "No scans remaining" : s.totalCredits === 1 ? "1 scan remaining" : `${s.totalCredits} scans remaining`}</p>
            {!s.hasUnlimited && <button onClick={onUpgrade} className={cls.btnGhost + " mt-3"}>Add more <I.ArrowR /></button>}
          </div>
          <div className="bg-paper border border-coffee/30 rounded-2xl p-6">
            <p className={cls.labelAccent + " mb-2"}>Scans Completed</p>
            <p className="font-hero text-5xl text-brown leading-none mb-2">{s.scanCount}</p>
            <p className="text-sm text-coffeeText">All-time readings</p>
          </div>
        </div>

        {/* Emotion Timeline */}
        <InnerViewTimeline />

        {s.hasUnlimited && (
          <div className="bg-paper border border-coffee/30 rounded-2xl p-6 mb-10 max-w-2xl">
            <p className={cls.labelAccent + " mb-2"}>Subscription</p>
            <p className={cls.body + " text-sm mb-1"}>
              Unlimited plan, status: <strong className="text-brown">{s.subscriptionStatus ?? "active"}</strong>
              {s.unlimitedUntil ? ` · renews ${new Date(s.unlimitedUntil).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}.
            </p>
            <p className={cls.body + " text-sm mb-4"}>Manage billing, pause your subscription, update your card, or cancel anytime — all in one place.</p>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={manageSubscription} disabled={openPortal.isPending} className={cls.btnPrimary + " !py-3 disabled:opacity-60"}>
                {openPortal.isPending ? "Opening…" : "Manage subscription"}
              </button>
              <span className="text-xs text-coffeeText">Opens Stripe's secure billing portal.</span>
            </div>
            {portalErr && <p className="text-sm mt-3 text-destructive">{portalErr}</p>}
          </div>
        )}

        <div className="bg-paper border border-coffee/30 rounded-2xl p-6 mb-10 max-w-2xl">
          <p className={cls.labelAccent + " mb-2"}>Have a promo code?</p>
          <p className={cls.body + " text-sm mb-4"}>Enter the code to add free scans to your account.</p>
          <form onSubmit={submitCode} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setRedeemMsg(null); }}
              placeholder="WELCOME10"
              className="flex-1 px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown uppercase tracking-wider focus:border-accent focus:outline-none"
              maxLength={40}
              autoComplete="off"
            />
            <button type="submit" disabled={redeem.isPending || !code.trim()} className={cls.btnPrimary + " !py-3 disabled:opacity-60"}>
              {redeem.isPending ? "Redeeming…" : "Redeem"}
            </button>
          </form>
          {redeemMsg && (
            <p className={`text-sm mt-3 ${redeemMsg.ok ? "text-green-700" : "text-destructive"}`}>{redeemMsg.text}</p>
          )}
        </div>
        <p className={cls.labelAccent + " mb-3"}>Your Reading History</p>
        <h2 className={cls.h2 + " text-2xl mb-5"}>Past scans.</h2>
        {history.data?.scans.length ? (
          <ul className="grid md:grid-cols-2 gap-4 mb-12">
            {history.data.scans.map((scan) => (
              <li key={scan.id} className="bg-paper border border-coffee/30 rounded-2xl p-5">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <span className="font-heading text-lg text-brown capitalize">{scan.scanMode || "Pet"} scan</span>
                  <span className="text-xs font-hero tracking-wider uppercase text-coffeeText">{new Date(scan.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <p className={cls.body + " text-sm"}>{scan.summary || "No summary saved."}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-paper border border-coffee/30 rounded-2xl p-8 text-center">
            <p className="font-body text-brown mb-2">Your pet's wellness journal is waiting for its first chapter.</p>
            <p className="text-sm text-coffeeText">Every scan builds a story only you can tell.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button onClick={onClose} className={cls.btnPrimary}>Scan a pet <I.ArrowR /></button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  PAYWALL                                                     */
/* ═══════════════════════════════════════════════════════════ */
function Paywall({ links, onClose, onAlreadyPaid, onSignOut, onRedeemed, couponCode, discounted, onAbout }: { links: PaymentLinks; onClose: () => void; onAlreadyPaid: () => void; onSignOut?: () => void; onRedeemed?: () => void; couponCode?: string; discounted?: boolean; onAbout?: () => void }) {
  const sessionToken = getSessionToken();
  const status = trpc.access.myStatus.useQuery({ sessionToken }, { enabled: Boolean(sessionToken) });
  const data = status.data;
  const signedIn = data?.signedIn === true;
  const signedInEmail = signedIn ? data.email : null;
  const utils = trpc.useUtils();
  const redeem = trpc.auth.redeemPromo.useMutation();
  const registerIntent = trpc.access.registerPurchaseIntent.useMutation();
  const [code, setCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (!sessionToken) {
      setRedeemMsg({ ok: false, text: "Sign in first to redeem a code." });
      return;
    }
    setRedeemMsg(null);
    try {
      const result = await redeem.mutateAsync({ sessionToken, code: code.trim() });
      if (result.ok) {
        setRedeemMsg({ ok: true, text: `${result.creditsGranted} scan${result.creditsGranted === 1 ? "" : "s"} added — taking you back…` });
        setCode("");
        await utils.access.myStatus.invalidate();
        setTimeout(() => onRedeemed?.(), 800);
      } else {
        const msgs: Record<string, string> = {
          invalid_code: "Code not found.",
          disabled: "Code is no longer active.",
          expired: "Code expired.",
          exhausted: "Code is fully redeemed.",
          already_redeemed: "You've already used this code.",
          not_signed_in: "Sign in first to redeem.",
        };
        setRedeemMsg({ ok: false, text: msgs[result.reason] ?? "Couldn't redeem." });
      }
    } catch {
      setRedeemMsg({ ok: false, text: "Couldn't redeem. Please try again." });
    }
  };
  const apply = (url: string) => discounted && couponCode ? withCoupon(url, couponCode) : url;
  // Append client_reference_id so the webhook can auto-create a session
  // when the user returns from Stripe.
  const deviceId = getDeviceId();
  const withClientRef = (url: string) => {
    if (!url || !deviceId) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}client_reference_id=${encodeURIComponent(deviceId)}`;
  };
  // Order: cheapest → Monthly (Most Loved, brown anchor) → Annual.
  // Monthly is the flagship; Annual is the value upsell.
  const tiers = [
    { name: "5 Scans",           price: discounted ? "$8.99" : "$9.99", unit: "",    scans: "5 scans",            perScan: "$2.00 per scan · Emotional View included", href: withClientRef(apply(links.starter)),    isSub: false, badge: null,                brown: false, original: discounted ? "$9.99" : null },
    { name: "Monthly Unlimited", price: "$19.99",                       unit: "/mo", scans: "Unlimited",          perScan: "Pause or cancel anytime",                  href: withClientRef(links.unlimited),         isSub: true,  badge: "Most Loved",        brown: true,  original: null },
    { name: "Annual Unlimited",  price: "$199",                         unit: "/yr", scans: "Unlimited · 1 year", perScan: "2 months free · cancel anytime",           href: withClientRef(links.unlimitedAnnual!),  isSub: true,  badge: "Best Value",        brown: false, original: null },
  ].filter((t) => t.href);

  const handleTierClick = async (href: string) => {
    if (deviceId) {
      try { await registerIntent.mutateAsync({ deviceId }); } catch {}
    }
    // Also store in localStorage so the returning page knows to poll
    try { localStorage.setItem("petview_pending_purchase", deviceId); } catch {}
    window.location.href = href;
  };
  return (
    <div className="min-h-screen bg-soft">
      <Header onAbout={onAbout ?? (() => {})} onScan={() => {}} onSignOut={onSignOut} />
      <VetBanner />
      <main id="main" tabIndex={-1} className={cls.container + " py-12 lg:py-20"}>
        <div className="flex items-start justify-between mb-10">
          <div>
            <p className={cls.labelAccent}>Continue Your Reading</p>
            <h1 className={cls.h1 + " text-4xl lg:text-5xl mt-2"}>{discounted ? "Top up your scans — 10% off today." : "Keep seeing what your pet is feeling."}</h1>
            <p className="font-body text-lg text-coffeeText max-w-2xl mt-4">Every scan includes both the physical wellness observation and the Emotional View emotional layer — two readings no other app offers.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-coffeeText hover:text-brown touch-min p-2"><I.Close c="w-6 h-6" /></button>
        </div>
        {discounted && (
          <div className="mb-6 px-4 py-3 bg-accent/10 border border-accent/30 rounded-xl text-sm text-brown max-w-3xl">
            <strong className="text-accent">10% off</strong> applied to packs — limited-time top-up offer.
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {tiers.map((t) => (
            <article
              key={t.name}
              className={`rounded-2xl p-7 flex flex-col ${
                t.brown
                  ? "bg-brown shadow-[0_8px_32px_-12px_rgba(51,29,1,0.35)]"
                  : "bg-paper border border-coffee/30"
              }`}
            >
              {t.badge && (
                <p className={`font-hero text-[10px] tracking-[0.22em] uppercase mb-2 ${t.brown ? "text-accent" : "text-accent"}`}>
                  {t.badge}
                </p>
              )}
              <h2 className={`font-heading text-2xl mb-1 ${t.brown ? "text-accent" : "text-brown"}`}>{t.name}</h2>
              <div className="my-4">
                {t.original && (
                  <span className={`block text-sm line-through mb-1 ${t.brown ? "text-coffeeLight/70" : "text-coffeeText"}`}>
                    {t.original}
                  </span>
                )}
                <p className={`font-hero text-5xl leading-none ${t.brown ? "text-accent" : "text-brown"}`}>
                  {t.price}
                  {t.unit && (
                    <span className={`text-base font-body font-normal ${t.brown ? "text-coffeeLight/80" : "text-coffeeText"}`}>
                      {t.unit}
                    </span>
                  )}
                </p>
              </div>
              <p className={`font-body text-base mb-1 ${t.brown ? "text-coffeeLight" : "text-brown"}`}>{t.scans}</p>
              <p className={`text-sm mb-3 ${t.brown ? "text-coffeeLight/70" : "text-coffeeText"}`}>{t.perScan}</p>
              <p className={`text-xs font-hero tracking-[0.18em] uppercase mb-6 flex items-center gap-1.5 ${t.brown ? "text-accent" : "text-accent"}`}>
                <span aria-hidden className="w-1 h-1 rounded-full bg-accent" /> Emotional View included
              </p>
              <button onClick={() => handleTierClick(t.href)} className={`${cls.btnPrimary} w-full mt-auto !py-4`}>
                {t.isSub ? "Subscribe" : `Buy ${t.name}`} <I.ArrowR />
              </button>
            </article>
          ))}
        </div>

        {/* Risk reversal + social proof */}
        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mb-8">
          <div className="bg-paper border border-coffee/30 rounded-2xl p-5">
            <p className="text-xs font-hero tracking-wider uppercase text-accent mb-2">Risk-free</p>
            <p className={cls.body + " text-sm"}><strong className="text-brown">14-day money-back guarantee</strong> on Unlimited. Cancel anytime through your Account page — no hoops, no emails, no hassle.</p>
          </div>
          <div className="bg-paper border border-coffee/30 rounded-2xl p-5">
            <p className="text-xs font-hero tracking-wider uppercase text-accent mb-2">What pet parents say</p>
            <p className={cls.body + " text-sm italic"}>Reviews from early users coming soon.</p>
          </div>
        </div>

        <div className="bg-paper border border-coffee/30 rounded-2xl p-5 max-w-3xl mb-6">
          <p className={cls.labelAccent + " mb-2"}>Have a promo code?</p>
          <p className={cls.body + " text-sm mb-3"}>
            {signedIn ? "Redeem to add free scans to your account." : "Sign in first, then redeem to add free scans."}
          </p>
          <form onSubmit={submitCode} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setRedeemMsg(null); }}
              placeholder="WELCOME10"
              className="flex-1 px-4 py-3 rounded-xl border border-coffee/40 bg-soft font-body text-brown uppercase tracking-wider focus:border-accent focus:outline-none"
              maxLength={40}
              autoComplete="off"
            />
            {signedIn ? (
              <button type="submit" disabled={redeem.isPending || !code.trim()} className={cls.btnPrimary + " !py-3 disabled:opacity-60"}>
                {redeem.isPending ? "Redeeming…" : "Redeem"}
              </button>
            ) : (
              <button type="button" onClick={onAlreadyPaid} className={cls.btnPrimary + " !py-3"}>
                Sign in to redeem
              </button>
            )}
          </form>
          {redeemMsg && (
            <p className={`text-sm mt-3 ${redeemMsg.ok ? "text-green-700" : "text-destructive"}`}>{redeemMsg.text}</p>
          )}
        </div>

        {signedIn ? (
          <div className="bg-paper border border-coffee/30 rounded-2xl p-5 max-w-3xl mb-6">
            <p className={cls.body + " text-sm mb-3"}>Signed in as <strong className="text-brown">{signedInEmail}</strong>. Purchases will be added to this account.</p>
            <button onClick={onSignOut} className={cls.btnGhost}>Not you? Sign out</button>
          </div>
        ) : (
          <div className="bg-paper border border-coffee/30 rounded-2xl p-5 max-w-3xl mb-6">
            <p className="font-heading font-medium text-brown mb-1">Already purchased?</p>
            <p className={cls.body + " text-sm mb-3"}>Sign in with the email you used at checkout — your scans are tied to your account, not this device.</p>
            <button onClick={onAlreadyPaid} className={cls.btnGhost}>Already purchased? Sign in</button>
          </div>
        )}
        <p className="text-xs text-brown max-w-3xl">
          Payments processed securely by Stripe. Receipts go to the email you provide at checkout. Scans never expire — use your pack at your own pace.
          One free scan per device.
        </p>
      </main>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  UNLOCK                                                      */
/* ═══════════════════════════════════════════════════════════ */
function UnlockPage({ onContinue, onSignin }: { onContinue: () => void; onSignin?: () => void }) {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id") ?? "";
  const [retries, setRetries] = useState(0);
  const [unlocked, setUnlocked] = useState<{ tier: string; credits: number } | null>(null);
  const [stuck, setStuck] = useState(false);
  const query = trpc.access.unlock.useQuery({ sessionId }, { enabled: Boolean(sessionId), refetchInterval: unlocked ? false : (retries > 8 ? false : 1500) });

  // Also try the new pending-purchase auto-login flow
  const deviceId = getDeviceId();
  const claimQuery = trpc.access.claimPurchase.useQuery(
    { deviceId },
    { enabled: Boolean(deviceId) && !sessionId, refetchInterval: unlocked ? false : (retries > 8 ? false : 1500) }
  );

  useEffect(() => {
    // Legacy unlock flow (pack purchases with session_id in URL)
    if (sessionId) {
      if (query.data && query.data.found) {
        setUnlockToken(query.data.unlockToken);
        setSessionToken(query.data.sessionToken);
        setUnlocked({ tier: query.data.tier, credits: query.data.credits });
        window.history.replaceState({}, "", "/");
        onContinue();
      } else if (query.isFetched) {
        setRetries((r) => r + 1);
        if (retries >= 8) setStuck(true);
      }
      return;
    }

    // New auto-login flow (subscriptions + packs via client_reference_id)
    if (claimQuery.data && claimQuery.data.found) {
      setSessionToken(claimQuery.data.sessionToken);
      try { localStorage.removeItem("petview_pending_purchase"); } catch {}
      window.history.replaceState({}, "", "/");
      onContinue();
    } else if (claimQuery.isFetched) {
      setRetries((r) => r + 1);
      if (retries >= 8) setStuck(true);
    }
  }, [query.data, query.isFetched, claimQuery.data, claimQuery.isFetched, retries, sessionId, onContinue]);

  return (
    <div className="min-h-screen bg-soft flex items-center justify-center px-6">
      <div className="bg-paper border border-coffee/30 rounded-2xl p-8 max-w-md w-full text-center">
        {!sessionId ? (
          <>
            <div className="w-12 h-12 rounded-full bg-accent/15 mx-auto mb-4 flex items-center justify-center text-accent"><I.Check c="w-6 h-6" /></div>
            <h2 className="font-heading text-xl text-brown mb-2">Your purchase is in.</h2>
            <p className={cls.body + " mb-6"}>Stripe didn't pass us your session ID on the redirect (this happens with some discount checkouts), but your credits are already attached to the email you used at checkout. Sign in with that email to continue.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              {onSignin && <button onClick={onSignin} className={cls.btnPrimary}>Sign in to use credits</button>}
              <button onClick={onContinue} className={cls.btnSecondary}>Back to PetView</button>
            </div>
          </>
        ) : unlocked ? (
          <>
            <div className="w-12 h-12 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center text-green-700"><I.Check c="w-6 h-6" /></div>
            <h2 className="font-heading text-xl text-brown mb-2">You're all set</h2>
            <p className={cls.body + " mb-2"}>Your <strong className="text-brown capitalize">{unlocked.tier} Pack</strong> is active on this device.</p>
            <p className={cls.body + " mb-6"}><strong className="text-accent">{unlocked.credits}</strong> scans available.</p>
            <button onClick={onContinue} className={cls.btnPrimary}>Begin a scan <I.ArrowR /></button>
          </>
        ) : stuck ? (
          <>
            <div className="w-12 h-12 rounded-full bg-coffeeLight mx-auto mb-4 flex items-center justify-center text-coffeeText"><I.Alert c="w-6 h-6" /></div>
            <h2 className="font-heading text-xl text-brown mb-2">Still waiting on Stripe…</h2>
            <p className={cls.body + " mb-6"}>Stripe usually confirms in a few seconds, but it can take up to a minute. Your credits are tied to your account email — if you don't see them here, sign in with that email from the home page.</p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => window.location.reload()} className={cls.btnPrimary}>Refresh</button>
              <button onClick={onContinue} className={cls.btnSecondary}>Back to home</button>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-coffeeLight mx-auto mb-4 flex items-center justify-center text-accent"><div className="h-1 w-6 shimmer-bar rounded-full" /></div>
            <h2 className="font-heading text-xl text-brown mb-2">Unlocking your pack…</h2>
            <p className={cls.body + " mb-4"}>Confirming your payment with Stripe.</p>
            <button onClick={onContinue} className={cls.btnGhost}>Back to home</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  ROOT                                                        */
/* ═══════════════════════════════════════════════════════════ */
export default function App() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const isUnlockPath = path === "/unlock";
  const isAuthPath = path === "/auth" || path.startsWith("/auth/");
  const isAdminPath = path === "/admin";
  const [screen, setScreen] = useState<Screen>(isAdminPath ? "admin" : isAuthPath ? "auth" : isUnlockPath ? "unlock" : "home");
  const [photos, setPhotos] = useState<PhotoMap>({});
  const [species, setSpecies] = useState<Species>("dog");
  const [petName, setPetName] = useState("");
  const [analysis, setAnalysis] = useState<ScanAnalysis | null>(null);
  const [paywallLinks, setPaywallLinks] = useState<PaymentLinks | null>(null);
  const [paywallDiscounted, setPaywallDiscounted] = useState(false);
  const [paywallCoupon, setPaywallCoupon] = useState<string | undefined>(undefined);
  const [signinError, setSigninError] = useState<string | undefined>(undefined);
  const [innerviewPhoto, setInnerviewPhoto] = useState<string>("");
  const [innerviewSpecies, setInnerviewSpecies] = useState<Species>("dog");
  const [innerviewText, setInnerviewText] = useState<string>("");
  const [innerviewEmotion, setInnerviewEmotion] = useState<{ dominantEmotion: string; confidence: number; valence: number; arousal: number; regionsObserved: string[]; contextualNote: string } | null>(null);
  const [innerviewContext, setInnerviewContext] = useState<{ location: string; recentEvent: string } | null>(null);
  const [innerviewBreed, setInnerviewBreed] = useState<string>("");
  const utils = trpc.useUtils();

  useEffect(() => {
    getDeviceId();
    try {
      const savedName = localStorage.getItem("petview_pet_name");
      if (savedName) setPetName(savedName);
    } catch {}
    console.log("[PetView] build:", BUILD_TIME);

    // Auto-login after Stripe purchase: if we have a pending purchase in
    // localStorage, poll the claim endpoint until the webhook has stored the
    // session token.
    const pendingDeviceId = (() => {
      try { return localStorage.getItem("petview_pending_purchase"); } catch { return null; }
    })();
    if (pendingDeviceId && !getSessionToken()) {
      let attempts = 0;
      const poll = async () => {
        try {
          const result = await utils.access.claimPurchase.fetch({ deviceId: pendingDeviceId });
          if (result.found) {
            setSessionToken(result.sessionToken);
            try { localStorage.removeItem("petview_pending_purchase"); } catch {}
            window.location.reload();
            return;
          }
        } catch {}
        attempts++;
        if (attempts < 10) setTimeout(poll, 2000);
        else {
          // Give up polling, but leave the localStorage flag so the unlock
          // page or a later refresh can still claim it.
          console.log("[PetView] pending purchase claim timed out");
        }
      };
      poll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginScan = useCallback(async () => {
    setPhotos({});
    setAnalysis(null);
    setPetName("");
    removeStorageItem("petview_pet_name");
    try {
      const decision = await utils.client.access.check.query({
        deviceId: getDeviceId(),
        sessionToken: getSessionToken(),
        unlockToken: getUnlockToken(),
        scanMode: "full",
      });
      if (!decision.allowed) {
        if (decision.reason === "needs_signin") {
          try { localStorage.setItem("petview_return_to", "petview"); } catch {}
          setScreen("signin"); return;
        }
        if (decision.reason === "paywall" && decision.paymentLinks) {
          try { localStorage.setItem("petview_return_to", "petview"); } catch {}
          setPaywallLinks(decision.paymentLinks);
          setPaywallCoupon(decision.couponCode);
          setPaywallDiscounted(false);
          setScreen("paywall");
          return;
        }
        if (decision.reason === "global_quota_exhausted" && decision.paymentLinks) {
          try { localStorage.setItem("petview_return_to", "petview"); } catch {}
          setPaywallLinks(decision.paymentLinks);
          setPaywallCoupon(undefined);
          setPaywallDiscounted(false);
          setScreen("paywall");
          return;
        }
      }
    } catch (e) {
      console.error("[PetView] beginScan access.check failed:", e);
      setScreen("home");
      return;
    }
    setScreen("tips");
  }, [utils]);

  const beginInnerView = useCallback(async () => {
    // Try to restore a saved draft so users don't lose their work
    try {
      const draft = localStorage.getItem("petview_innerview_draft");
      if (draft) {
        const d = JSON.parse(draft);
        setInnerviewPhoto(d.photo ?? "");
        setInnerviewSpecies(d.species ?? "dog");
        setInnerviewContext(d.context ?? null);
        setInnerviewBreed(d.breed ?? "");
        setInnerviewPetName(d.petName ?? "");
      } else {
        setInnerviewPhoto("");
        setInnerviewText("");
      }
    } catch {
      setInnerviewPhoto("");
      setInnerviewText("");
    }
    try {
      const decision = await utils.client.access.check.query({
        deviceId: getDeviceId(),
        sessionToken: getSessionToken(),
        unlockToken: getUnlockToken(),
        scanMode: "innerview",
      });
      if (!decision.allowed) {
        if (decision.reason === "needs_signin") {
          try { localStorage.setItem("petview_return_to", "innerview"); } catch {}
          setScreen("signin"); return;
        }
        if (decision.reason === "paywall" && decision.paymentLinks) {
          try { localStorage.setItem("petview_return_to", "innerview"); } catch {}
          setPaywallLinks(decision.paymentLinks);
          setPaywallCoupon(decision.couponCode);
          setPaywallDiscounted(false);
          setScreen("paywall");
          return;
        }
        if (decision.reason === "global_quota_exhausted" && decision.paymentLinks) {
          try { localStorage.setItem("petview_return_to", "innerview"); } catch {}
          setPaywallLinks(decision.paymentLinks);
          setPaywallCoupon(undefined);
          setPaywallDiscounted(false);
          setScreen("paywall");
          return;
        }
      }
    } catch (e) {
      console.error("[PetView] beginInnerView access.check failed:", e);
      setScreen("home");
      return;
    }
    setScreen("innerview_capture");
  }, [utils]);

  const openPaywall = useCallback(async (discounted = false) => {
    try {
      const links = await utils.access.paymentLinks.fetch();
      setPaywallLinks({ starter: links.starter, pro: links.pro, unlimited: links.unlimited, unlimitedAnnual: links.unlimitedAnnual });
      setPaywallCoupon(links.couponCode);
      setPaywallDiscounted(discounted);
      setScreen("paywall");
    } catch { setScreen("paywall"); }
  }, [utils]);

  const startNew = beginScan;

  const resumeScan = useCallback(() => {
    // Clear any stale access gate cache so the next scan check is fresh
    utils.access.check.invalidate();
    utils.access.myStatus.invalidate();
    let returnTo: string | null = null;
    try { returnTo = localStorage.getItem("petview_return_to"); localStorage.removeItem("petview_return_to"); } catch {}
    if (returnTo === "innerview") {
      // Restore draft form state if available
      try {
        const draft = localStorage.getItem("petview_innerview_draft");
        if (draft) {
          const d = JSON.parse(draft);
          setInnerviewPhoto(d.photo ?? "");
          setInnerviewSpecies(d.species ?? "dog");
          setInnerviewContext(d.context ?? null);
          setInnerviewBreed(d.breed ?? "");
          setInnerviewPetName(d.petName ?? "");
        } else {
          setInnerviewPhoto(""); setInnerviewText(""); setInnerviewEmotion(null);
          setInnerviewBreed(""); setInnerviewPetName(""); setInnerviewContext(null);
        }
      } catch {
        setInnerviewPhoto(""); setInnerviewText(""); setInnerviewEmotion(null);
        setInnerviewBreed(""); setInnerviewPetName(""); setInnerviewContext(null);
      }
      setScreen("innerview_capture");
      return;
    }
    if (Object.keys(photos).length > 0) {
      console.log("[PetView] resuming interrupted scan");
      setScreen("analyzing");
    } else {
      beginScan();
    }
  }, [photos, beginScan, utils]);

  const handleSubmit = useCallback((p: PhotoMap, sp: Species, name?: string) => {
    setPhotos(p);
    setSpecies(sp);
    if (name) setPetName(name);
    setScreen("analyzing");
  }, []);

  const handleComplete = useCallback((r: ScanAnalysis) => {
    setAnalysis(r);
    setScreen("result");
  }, []);

  const [innerviewPetName, setInnerviewPetName] = useState<string>("");
  const handleInnerViewSubmit = useCallback((photo: string, sp: Species, context?: { location: string; recentEvent: string }, breed?: string, petName?: string) => {
    setInnerviewPhoto(photo);
    setInnerviewSpecies(sp);
    setInnerviewContext(context ?? null);
    setInnerviewBreed(breed ?? "");
    setInnerviewPetName(petName ?? "");
    // Persist form state so auth redirect doesn't lose the user's work
    try {
      setStorageItem("petview_innerview_draft", JSON.stringify({ photo, species: sp, context, breed, petName }));
    } catch {}
    setScreen("innerview_analyzing");
  }, []);

  const handleInnerViewComplete = useCallback((text: string, emotion?: { dominantEmotion: string; confidence: number; valence: number; arousal: number; regionsObserved: string[]; contextualNote: string }) => {
    setInnerviewText(text);
    setInnerviewEmotion(emotion ?? null);
    // Clear draft on successful completion
    removeStorageItem("petview_innerview_draft");
    setScreen("innerview_result");
  }, []);

  const handlePaywall = useCallback((links: PaymentLinks) => {
    setPaywallLinks(links);
    setScreen("paywall");
  }, []);

  const handleSignOut = useCallback(async () => {
    const t = getSessionToken();
    if (t) { try { await utils.client.auth.signOut.mutate({ sessionToken: t }); } catch {} }
    clearSessionToken();
    setScreen("home");
  }, [utils]);

  const goAbout = () => setScreen("about");

  let page: React.ReactNode;
  if (screen === "auth")           page = <AuthPage onSignedIn={resumeScan} onError={(msg) => { setSigninError(msg); setScreen("signin"); }} />;
  else if (screen === "signin")    page = <SigninScreen onClose={() => { setSigninError(undefined); setScreen("home"); }} errorMsg={signinError} />;
  else if (screen === "account")   page = <AccountPage onClose={() => setScreen("home")} onSignedOut={() => setScreen("home")} onUpgrade={() => openPaywall(false)} onAbout={goAbout} onSignOut={handleSignOut} />;
  else if (screen === "unlock")    page = <UnlockPage onContinue={() => setScreen("home")} onSignin={() => setScreen("signin")} />;
  else if (screen === "paywall" && paywallLinks) page = <Paywall links={paywallLinks} couponCode={paywallCoupon} discounted={paywallDiscounted} onClose={() => setScreen("home")} onAlreadyPaid={() => setScreen("signin")} onRedeemed={beginScan} onAbout={goAbout} onSignOut={handleSignOut} />;
  else if (screen === "science")   page = <SciencePage onBack={() => setScreen("home")} onAbout={goAbout} onScan={beginInnerView} onSignin={() => setScreen("signin")} onAccount={() => setScreen("account")} onSignOut={handleSignOut} onAdmin={() => setScreen("admin")} />;
  else if (screen === "admin")     page = <AdminPage onClose={() => setScreen("home")} />;
  else if (screen === "about")     page = <AboutPage onBack={() => setScreen("home")} />;
  else if (screen === "tips")      page = <TipsScreen onContinue={(name) => { setPetName(name); setStorageItem("petview_pet_name", name); setScreen("capture"); }} onClose={() => setScreen("home")} onAbout={goAbout} onInnerView={beginInnerView} onSignOut={handleSignOut} />;
  else if (screen === "capture")   page = <CaptureScreen onSubmit={handleSubmit} onClose={() => setScreen("home")} onAbout={goAbout} petName={petName} onSignOut={handleSignOut} />;
  else if (screen === "analyzing") page = <AnalyzingScreen photos={photos} species={species} onComplete={handleComplete} onPaywall={(links) => { try { localStorage.setItem("petview_return_to", "petview"); } catch {} handlePaywall(links); }} onSignin={() => { try { localStorage.setItem("petview_return_to", "petview"); } catch {} setScreen("signin"); }} onRetry={() => setScreen("capture")} onAbout={goAbout} petName={petName} onSignOut={handleSignOut} />;
  else if (screen === "result" && analysis) page = <ResultScreen result={analysis} photos={photos} onClose={() => setScreen("home")} onNewScan={startNew} onAccount={() => setScreen("account")} onAbout={goAbout} onUpsell={() => openPaywall(true)} onSignin={() => setScreen("signin")} petName={petName} onSignOut={handleSignOut} />;
  else if (screen === "innerview_capture") page = <InnerViewCaptureScreen onSubmit={handleInnerViewSubmit} onClose={() => setScreen("home")} onAbout={goAbout} onFullScan={beginScan} onSignOut={handleSignOut} />;
  else if (screen === "innerview_analyzing") page = <InnerViewAnalyzingScreen photo={innerviewPhoto} species={innerviewSpecies} context={innerviewContext} petName={innerviewPetName} onComplete={handleInnerViewComplete} onPaywall={(links) => { try { localStorage.setItem("petview_return_to", "innerview"); } catch {} handlePaywall(links); }} onSignin={() => { try { localStorage.setItem("petview_return_to", "innerview"); } catch {} setScreen("signin"); }} onRetry={() => setScreen("innerview_capture")} onAbout={goAbout} onSignOut={handleSignOut} />;
  else if (screen === "innerview_result" && innerviewText) page = <InnerViewResultScreen text={innerviewText} emotion={innerviewEmotion} photo={innerviewPhoto} species={innerviewSpecies} breed={innerviewBreed} petName={innerviewPetName} onNewScan={beginInnerView} onFullScan={beginScan} onClose={() => setScreen("home")} onAbout={goAbout} onSignin={() => setScreen("signin")} onSignOut={handleSignOut} />;
  else page = <Home onInnerView={beginInnerView} onPetView={beginScan} onAbout={() => setScreen("about")} onScience={() => setScreen("science")} onSignin={() => setScreen("signin")} onAccount={() => setScreen("account")} onSignOut={handleSignOut} onAdmin={() => setScreen("admin")} />;

  return <>{page}<CookieBanner /></>;
}
