import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { usePWA } from "@/hooks/use-pwa";
import { useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import {
  GraduationCap,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  Award,
  Star,
  TrendingUp,
  LayoutGrid,
  ChevronRight,
  CheckCircle2,
  Download,
  ArrowRight,
  Users,
  BookOpen,
  Trophy,
  Medal,
  ChevronLeft,
  Search,
} from "lucide-react";
import coachingLogo from "@assets/IMG_20260126_081644_1769393818079.jpg";
import heroBg from "@assets/hero-bg.webp";
import aboutPhoto2 from "@assets/PXL_20251115_062454776~2_1776221702373.jpg";
import aboutPhoto3 from "@assets/PXL_20251115_062309530~2_1776252686289.jpg";
import aboutPhoto4 from "@assets/IMG_20260417_163713~2.jpg.jpeg";

/* ─── DATA ─────────────────────────────────────────────────── */

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Programs", href: "#portals" },
  { label: "Teachers", href: "#teachers" },
  { label: "Results", href: "#results" },
  { label: "Alumni", href: "#alumni" },
  { label: "Contact", href: "#contact" },
];

const portals = [
  {
    icon: GraduationCap,
    title: "Student Portal",
    subtitle: "Academic & Payments",
    desc: "Access your payment history, academic results, model test scores, and account status from one personalised dashboard.",
    path: "/student",
    accentColor: "bg-blue-600",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    borderHover: "hover:border-blue-200",
  },
  {
    icon: LayoutGrid,
    title: "Teacher Panel",
    subtitle: "Admissions & Marks",
    desc: "Handle student admissions, record exam marks, manage batches, and track monthly fee payments efficiently.",
    path: "/teacher",
    accentColor: "bg-indigo-600",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    borderHover: "hover:border-indigo-200",
  },
  {
    icon: ShieldCheck,
    title: "Authority Access",
    subtitle: "Full Admin Control",
    desc: "Complete oversight of finances, teacher management, batch analytics, and centre-wide system administration.",
    path: "/admin",
    accentColor: "bg-slate-700",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-700",
    borderHover: "hover:border-slate-200",
  },
];

const aboutFeatures = [
  "Expert faculty for every subject",
  "Regular mock tests & model exams",
  "Personal performance tracking",
  "Small batch sizes for focused learning",
  "Dedicated academic counselling",
];

// Add more images here to expand the About carousel
const aboutImages = [
  { src: aboutPhoto2, alt: "DCC students and faculty group photo" },
  { src: heroBg,      alt: "DCC student group at the coaching centre" },
  { src: aboutPhoto3, alt: "DCC student group outdoor photo" },
  { src: aboutPhoto4, alt: "DCC student group outdoor photo" },
];

const alumni = [
  {
    name: "Annie Mohuri",
    achievement: "GPA 5.00 — SSC 2021",
    university: "University of Chittagong",
    batch: "Batch 2024–25",
    quote: "DCC's structured teaching and mock tests gave me the confidence to achieve a perfect GPA.",
    initials: "SI",
    color: "bg-blue-500",
  },
  {
    name: "Asmaul Hosna Maisha",
    achievement: "GPA 5.00 — SSC 2021",
    university: "Cox’s Bazar Medical College ",
    batch: "Batch 2024–25",
    quote: "The teachers here are incredibly dedicated. Their individual attention made all the difference.",
    initials: "MH",
    color: "bg-indigo-500",
  },
  {
    name: "Ariful Islam",
    achievement: "GPA 5.00 — SSC 2020",
    university: "CVASU",
    batch: "Batch 2023–24",
    quote: "DCC is not just a coaching centre — it's a family. The environment pushed me to be my best.",
    initials: "FZ",
    color: "bg-violet-500",
  },
  {
    name: "Govina Das",
    achievement: "GPA 4.92 — HSC 2023",
    university: "Chittagong University",
    batch: "Batch 2021–23",
    quote: "The mock tests and result tracking at DCC kept me focused throughout my academic journey.",
    initials: "RA",
    color: "bg-teal-500",
  },
  {
    name: "Nusrat Jahan",
    achievement: "GPA 5.00 — SSC 2024",
    university: "Viqarunnisa Noon College",
    batch: "Batch 2022–24",
    quote: "I never imagined getting GPA 5 until DCC showed me exactly how to get there.",
    initials: "NJ",
    color: "bg-cyan-600",
  },
  {
    name: "Arif Hossain",
    achievement: "GPA 4.83 — HSC 2023",
    university: "Dhaka University",
    batch: "Batch 2021–23",
    quote: "DCC's guidance helped me turn my weaknesses into strengths before the final exams.",
    initials: "AH",
    color: "bg-blue-700",
  },
];

const TEACHER_AVATAR_COLORS = [
  "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-teal-500", "bg-cyan-600", "bg-slate-600",
];

/* ─── HELPERS ───────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

/* ─── COMPONENTS ────────────────────────────────────────────── */

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0">
        <img src={coachingLogo} alt="DCC Logo" className="w-full h-full object-cover" />
      </div>
      <div>
        <div className="font-black text-slate-900 text-lg leading-none tracking-tight">DCC</div>
        <div className="text-slate-400 text-[10px] leading-none tracking-wide">Dynamic Coaching Center</div>
      </div>
    </div>
  );
}

/* ─── HEADER ────────────────────────────────────────────────── */

function Header({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        <Logo />
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-slate-600 text-sm font-medium hover:text-blue-600 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
          data-testid="button-nav-get-in-touch"
          onClick={() => onNavigate("/student")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          Get In Touch <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

/* ─── HERO ──────────────────────────────────────────────────── */

function HeroSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section
      id="home"
      className="relative pt-16 min-h-[100svh] sm:min-h-screen flex items-center overflow-hidden bg-slate-900"
    >
      {/* Full-width background image — object-top keeps students' faces visible on mobile */}
      <img
        src={heroBg}
        alt=""
        fetchPriority="high"
        loading="eager"
        decoding="async"
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      {/* Mobile: top-to-bottom overlay so text stays legible on portrait layout */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900/80 sm:hidden" />
      {/* Desktop: heavier on left for side-by-side text legibility */}
      <div className="absolute inset-0 hidden sm:block bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/30" />
      {/* Subtle blue tint overlay — full coverage on all sizes */}
      <div className="absolute inset-0 bg-blue-900/20" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-white/90 text-xs font-semibold tracking-wide">Admissions Open</span>
          </div>

          {/* Main heading */}
          <h1 className="font-black text-white text-5xl sm:text-6xl lg:text-7xl leading-[1.05] mb-5 drop-shadow-lg">
            Dynamic<br />
            <span className="text-blue-400">Coaching</span><br />
            Center
          </h1>

          <p className="text-white/80 text-lg sm:text-xl leading-relaxed mb-10 max-w-lg">
            Start your career &amp; pursue your passion. We equip every student with the knowledge and confidence to succeed.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#portals"
              data-testid="button-hero-view-programs"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-colors shadow-lg"
            >
              View our Programs <ChevronRight className="w-4 h-4" />
            </a>
            <a
              href="#about"
              data-testid="link-hero-about"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/25 text-white font-semibold text-sm hover:bg-white/20 transition-colors"
            >
              Learn More
            </a>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap items-center gap-8 mt-14 pt-8 border-t border-white/15">
            {[
              { value: "170+", label: "Students Enrolled" },
              { value: "98%", label: "Pass Rate" },
              { value: "6+", label: "Years of Excellence" },
              { value: "12+", label: "GPA 5.00 Achievers" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-white font-black text-2xl">{stat.value}</div>
                <div className="text-white/60 text-xs mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PORTALS ───────────────────────────────────────────────── */

function PortalsSection({
  onNavigate,
  onInstall,
  canInstall,
}: {
  onNavigate: (path: string) => void;
  onInstall: (preferredRoute: string) => void;
  canInstall: boolean;
}) {
  return (
    <section id="portals" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="text-center mb-12">
          <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Access Portals</p>
          <h2 className="font-black text-slate-900 text-4xl sm:text-5xl mb-4">
            Choose Your <span className="text-blue-600">Portal</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Dedicated dashboards for every role in the Dynamic Coaching Centre ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((portal) => {
            const Icon = portal.icon;
            const testId = portal.title.replace(/\s+/g, "-").toLowerCase();
            return (
              <div
                key={portal.path}
                data-testid={`card-portal-${testId}`}
                className={`flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl ${portal.borderHover} hover:-translate-y-1 transition-all duration-300 overflow-hidden`}
              >
                {/* Coloured top accent bar */}
                <div className={`h-1 w-full ${portal.accentColor}`} />

                <div className="flex flex-col flex-1 p-7">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl ${portal.iconBg} flex items-center justify-center mb-5`}>
                    <Icon className={`w-7 h-7 ${portal.iconColor}`} />
                  </div>

                  <h3 className="font-black text-slate-900 text-xl mb-1">{portal.title}</h3>
                  <p className={`text-xs font-bold mb-3 ${portal.iconColor}`}>{portal.subtitle}</p>
                  <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-6">{portal.desc}</p>

                  {/* Buttons */}
                  <div className="flex flex-col gap-3">
                    <button
                      data-testid={`button-login-${testId}`}
                      onClick={() => onNavigate(portal.path)}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl ${portal.accentColor} text-white text-sm font-bold hover:opacity-90 transition-opacity shadow-sm`}
                    >
                      Login Now <ChevronRight className="w-4 h-4" />
                    </button>

                    {canInstall && (
                      <button
                        data-testid={`button-install-${testId}`}
                        onClick={() => onInstall(portal.path)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors"
                      >
                        <Download className="w-4 h-4" /> Install App
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!canInstall && (
          <p className="text-center text-slate-400 text-xs mt-8">
            To install the app, open this page in Chrome or Edge on Android and use the browser menu → "Add to Home Screen".
          </p>
        )}
      </div>
    </section>
  );
}

/* ─── ABOUT ─────────────────────────────────────────────────── */

function AboutSection() {
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const aboutTitle = settings?.about_title || "Shaping Futures Through Quality Education";
  const aboutDesc =
    settings?.about_description ||
    "Dynamic Coaching Center provides a structured, result-oriented learning environment where students gain the knowledge, skills, and confidence to excel in their academic journey. Our expert faculty, personalised approach, and rigorous practice tests ensure every student reaches their full potential.";

  // Carousel state
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [aboutIdx, setAboutIdx] = useState(0);
  const [aboutHovered, setAboutHovered] = useState(false);

  const scrollToAbout = useCallback(
    (i: number) => emblaApi && emblaApi.scrollTo(i),
    [emblaApi]
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setAboutIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || aboutHovered) return;
    const id = setInterval(() => emblaApi.scrollNext(), 4000);
    return () => clearInterval(id);
  }, [emblaApi, aboutHovered]);

  return (
    <section id="about" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Left: Image Carousel */}
          <div className="relative">
            <div
              className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/5] max-w-sm mx-auto lg:mx-0"
              onMouseEnter={() => setAboutHovered(true)}
              onMouseLeave={() => setAboutHovered(false)}
            >
              {/* Embla viewport */}
              <div ref={emblaRef} className="overflow-hidden w-full h-full">
                <div className="flex h-full">
                  {aboutImages.map((img, i) => (
                    <div key={i} className="flex-[0_0_100%] min-w-0 h-full">
                      <img
                        src={img.src}
                        alt={img.alt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Overlay gradient */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-slate-900/70 to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-5 pointer-events-none">
                <p className="text-white font-bold text-sm">Academic Excellence</p>
                <p className="text-white/70 text-xs mt-0.5">Empowering students since 2020</p>
              </div>

              {/* Navigation dots */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                {aboutImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToAbout(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === aboutIdx ? "bg-white scale-125" : "bg-white/50"
                    }`}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Floating stat card */}
            <div className="absolute -bottom-5 -right-4 lg:-right-8 bg-white rounded-2xl shadow-xl px-5 py-4 border border-blue-50 flex items-center gap-3 z-10">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-black text-slate-900 text-base">12+ GPA 5.00</div>
                <div className="text-slate-500 text-xs">Students in 2025</div>
              </div>
            </div>

            {/* Top badge */}
            <div className="absolute top-5 -left-4 lg:-left-8 bg-blue-600 text-white rounded-2xl shadow-xl px-4 py-3 z-10">
              <div className="font-black text-xl leading-none">6+</div>
              <div className="text-blue-200 text-xs mt-0.5">Years Active</div>
            </div>
          </div>

          {/* Right: Content */}
          <div>
            <p className="text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">About the Coaching</p>
            <h2 className="font-black text-slate-900 text-4xl sm:text-5xl leading-tight mb-5">
              {aboutTitle}
            </h2>
            <p className="text-slate-500 text-base leading-relaxed mb-7">
              {aboutDesc}
            </p>

            <ul className="space-y-3.5 mb-8">
              {aboutFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-slate-700 text-sm font-medium">
                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>

            {/* Stats row */}
            <div className="flex flex-wrap gap-6 pt-6 border-t border-slate-200">
              {[
                { value: "170+", label: "Students" },
                { value: "98%", label: "Pass Rate" },
                { value: "12+", label: "Expert Faculty" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-black text-blue-600 text-2xl">{stat.value}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── TEACHERS ──────────────────────────────────────────────── */

function TeachersSection() {
  const { data: teachers, isLoading } = useQuery<
    { id: number; username: string; name: string | null; subject: string | null }[]
  >({ queryKey: ["/api/teachers"] });

  const hasTeachers = teachers && teachers.length > 0;

  return (
    <section id="teachers" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">Our Faculty</p>
          <h2 className="font-black text-slate-900 text-4xl sm:text-5xl mb-4">
            Meet Your <span className="text-blue-600">Teachers</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Experienced educators dedicated to helping every student achieve outstanding results.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-slate-100 rounded w-full mb-2" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : hasTeachers ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...teachers].sort((a, b) => parseInt((a as any).teacherId || '0') - parseInt((b as any).teacherId || '0')).map((teacher, idx) => {
              const displayName = teacher.name || teacher.username;
              const displaySubject = teacher.subject || "Teacher";
              const initials = getInitials(displayName);
              const avatarColor = TEACHER_AVATAR_COLORS[idx % TEACHER_AVATAR_COLORS.length];
              return (
                <div
                  key={teacher.id}
                  data-testid={`card-teacher-${teacher.id}`}
                  className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-100 hover:-translate-y-1 transition-all duration-300 p-6"
                >
                  <div className="flex items-center gap-4 mb-5">
                    <div className={`w-16 h-16 rounded-2xl ${avatarColor} flex items-center justify-center border-4 border-white shadow-md shrink-0`}>
                      <span className="font-black text-white text-xl">{initials}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{displayName}</h4>
                      <p className="text-blue-600 text-xs font-semibold mt-0.5">{displaySubject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-blue-400 text-blue-400" />
                    ))}
                    <span className="text-slate-400 text-xs ml-1">5.0</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-slate-600 text-xs">Expert faculty at Dynamic Coaching Center</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-xl mb-2">Faculty Profiles Coming Soon</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">Our talented teaching staff will be listed here. Check back soon!</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── ALUMNI / WALL OF FAME ─────────────────────────────────── */

function AlumniSection() {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
    dragFree: false,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );

  // Track selected snap and build dots
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  // Auto-play: advance one slide every 4 seconds, pause on hover
  useEffect(() => {
    if (!emblaApi || isPaused) return;
    const timer = setInterval(() => emblaApi.scrollNext(), 4000);
    return () => clearInterval(timer);
  }, [emblaApi, isPaused]);

  return (
    <section id="alumni" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-12">
          <p className="text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">Kriti Shikkharthi</p>
          <h2 className="font-black text-slate-900 text-4xl sm:text-5xl mb-4">
            Wall of <span className="text-blue-600">Fame</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Our proudest achievers who made DCC shine on the national stage.
          </p>
        </div>

        {/* Carousel viewport */}
        <div
          ref={emblaRef}
          className="overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div className="flex">
            {alumni.map((student) => (
              <div
                key={student.name}
                /* 1 card on mobile, 2 on tablet, 3 on desktop — with horizontal padding as gap */
                className="flex-none w-full md:w-1/2 lg:w-1/3 px-3"
              >
                <div
                  data-testid={`card-alumni-${student.name.replace(/\s+/g, "-").toLowerCase()}`}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-100 hover:-translate-y-1 transition-all duration-300 p-6 h-full"
                >
                  {/* Avatar row */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-14 h-14 rounded-2xl ${student.color} flex items-center justify-center border-4 border-white shadow-md shrink-0`}>
                      <span className="font-black text-white text-lg">{student.initials}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{student.name}</h4>
                      <div className="flex items-center gap-0.5 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-blue-400 text-blue-400" />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-blue-600 text-xs font-bold">{student.achievement}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-600 text-xs font-medium">{student.university}</span>
                  </div>

                  <div className="relative pl-4 border-l-2 border-blue-200">
                    <p className="text-slate-500 text-sm leading-relaxed italic">"{student.quote}"</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 text-slate-400 text-xs">
                    {student.batch}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation dots */}
        <div className="flex justify-center items-center gap-2 mt-8">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              data-testid={`dot-alumni-${index}`}
              onClick={() => scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`rounded-full transition-all duration-300 ${
                index === selectedIndex
                  ? "w-6 h-2.5 bg-blue-600"
                  : "w-2.5 h-2.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── RESULTS ───────────────────────────────────────────────── */

type PublicResult = {
  id: number;
  studentId: number;
  studentName: string;
  batchId: number;
  batchName: string;
  subject: string;
  examName: string;
  totalMarks: number;
  obtainedMarks: number;
};

const PAGE_SIZE = 10;

function ResultsSection() {
  const { data: results = [], isLoading } = useQuery<PublicResult[]>({
    queryKey: ["/api/public/results"],
    refetchInterval: 15000,
  });

  const [batch, setBatch] = useState<string>("");
  const [examName, setExamName] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [page, setPage] = useState(1);

  const batches = Array.from(new Set(results.map(r => r.batchName).filter(Boolean))).sort();
  const subjectsForBatch = Array.from(
    new Set(results.filter(r => !batch || r.batchName === batch).map(r => r.subject).filter(Boolean))
  ).sort();
  const examsForFilter = Array.from(
    new Set(
      results
        .filter(r => (!batch || r.batchName === batch) && (!subject || r.subject === subject))
        .map(r => r.examName)
        .filter(Boolean)
    )
  ).sort();

  useEffect(() => { setPage(1); }, [batch, subject, examName]);
  useEffect(() => {
    if (subject && !subjectsForBatch.includes(subject)) setSubject("");
  }, [batch]);
  useEffect(() => {
    if (examName && !examsForFilter.includes(examName)) setExamName("");
  }, [batch, subject]);

  const filtered = results
    .filter(r => (!batch || r.batchName === batch))
    .filter(r => (!subject || r.subject === subject))
    .filter(r => (!examName || r.examName === examName));

  const ranked = [...filtered]
    .sort((a, b) => b.obtainedMarks - a.obtainedMarks)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const paged = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allFiltersSelected = batch && examName && subject;

  const rankBadge = (rank: number) => {
    if (rank === 1) return "bg-amber-100 text-amber-700 ring-1 ring-amber-300";
    if (rank === 2) return "bg-slate-200 text-slate-700 ring-1 ring-slate-300";
    if (rank === 3) return "bg-orange-100 text-orange-700 ring-1 ring-orange-300";
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
  };

  const rowHighlight = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-amber-50 to-white";
    if (rank === 2) return "bg-gradient-to-r from-slate-50 to-white";
    if (rank === 3) return "bg-gradient-to-r from-orange-50 to-white";
    return "bg-white";
  };

  return (
    <section id="results" className="py-20 bg-gradient-to-b from-blue-50 via-white to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <p className="text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">Academic Performance</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Exam <span className="text-blue-600">Results</span>
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Browse published exam results by batch, exam, and subject. Top performers are highlighted.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Batch</label>
              <select
                value={batch}
                onChange={e => setBatch(e.target.value)}
                data-testid="select-batch"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Batch</option>
                {batches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Subject</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                data-testid="select-subject"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
                disabled={!batch}
              >
                <option value="">Select Subject</option>
                {subjectsForBatch.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Exam Name</label>
              <select
                value={examName}
                onChange={e => setExamName(e.target.value)}
                data-testid="select-exam"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
                disabled={!subject}
              >
                <option value="">Select Exam Name</option>
                {examsForFilter.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
          {isLoading ? (
            <div className="py-20 text-center text-slate-500 text-sm">Loading results...</div>
          ) : !allFiltersSelected ? (
            <div className="py-16 px-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 mb-4">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Select filters to view results</h3>
              <p className="text-sm text-slate-500">Choose a batch, exam, and subject to see published marks and ranks.</p>
            </div>
          ) : ranked.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-1">No results found</h3>
              <p className="text-sm text-slate-500">Nothing has been published for this combination yet.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-results">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="py-3 px-3 sm:px-4 text-left font-semibold whitespace-nowrap">ID</th>
                      <th className="py-3 px-3 sm:px-4 text-left font-semibold">Student Name</th>
                      <th className="py-3 px-3 sm:px-4 text-center font-semibold whitespace-nowrap">Total</th>
                      <th className="py-3 px-3 sm:px-4 text-center font-semibold whitespace-nowrap">Obtained</th>
                      <th className="py-3 px-3 sm:px-4 text-center font-semibold whitespace-nowrap">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(r => (
                      <tr
                        key={r.id}
                        data-testid={`row-result-${r.id}`}
                        className={`border-t border-slate-100 ${rowHighlight(r.rank)}`}
                      >
                        <td className="py-3 px-3 sm:px-4 font-mono text-xs text-slate-500">{r.studentId}</td>
                        <td className="py-3 px-3 sm:px-4 font-semibold text-slate-800">
                          <div className="flex items-center gap-2">
                            {r.rank === 1 && <Trophy className="w-4 h-4 text-amber-500 shrink-0" />}
                            {r.rank === 2 && <Medal className="w-4 h-4 text-slate-400 shrink-0" />}
                            {r.rank === 3 && <Medal className="w-4 h-4 text-orange-500 shrink-0" />}
                            <span className="truncate">{r.studentName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-center text-slate-700">{r.totalMarks}</td>
                        <td className="py-3 px-3 sm:px-4 text-center font-bold text-blue-700">{r.obtainedMarks}</td>
                        <td className="py-3 px-3 sm:px-4 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-xs font-bold ${rankBadge(r.rank)}`}>
                            #{r.rank}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500" data-testid="text-results-count">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, ranked.length)} of {ranked.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-blue-50 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                  </button>
                  <span className="text-xs font-semibold text-slate-600" data-testid="text-page-info">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    data-testid="button-next-page"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── CONTACT ───────────────────────────────────────────────── */

function ContactSection() {
  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-blue-600 text-sm font-bold uppercase tracking-widest mb-3">Find Us</p>
          <h2 className="font-black text-slate-900 text-4xl sm:text-5xl mb-4">
            Contact & <span className="text-blue-600">Location</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Come visit us or reach out — we're always happy to help students and parents.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact Info */}
          <div className="space-y-4">
            {/* Address */}
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-blue-50">
                <MapPin className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">Address</h4>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Khotija Bhavan, Opposite of Land Office<br />
                  (Lane beside Shahid Computer)<br />
                  Jaldi, Banhskhali, Chattogram
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50">
                <Phone className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">Phone</h4>
                <div className="flex flex-col gap-0.5">
                  {["01814-362956", "01306-743336", "01538-255904"].map((num) => (
                    <a key={num} href={`tel:${num.replace(/-/g, "")}`} className="text-slate-500 text-sm hover:text-blue-600 transition-colors">
                      {num}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-slate-100">
                <Mail className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">Email</h4>
                <a
                  href="mailto:dynamicoachingcenter@gmail.com"
                  className="text-slate-500 text-sm hover:text-blue-600 transition-colors"
                >
                  dynamicoachingcenter@gmail.com
                </a>
              </div>
            </div>

            {/* Quick portal links */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
              <h4 className="font-bold text-lg mb-4">Quick Portal Access</h4>
              <div className="space-y-3">
                {[
                  { label: "Student Portal", path: "/student", icon: GraduationCap },
                  { label: "Teacher Panel", path: "/teacher", icon: LayoutGrid },
                  { label: "Authority Access", path: "/admin", icon: ShieldCheck },
                ].map(({ label, path, icon: Icon }) => (
                  <a
                    key={path}
                    href={path}
                    data-testid={`link-contact-${label.replace(/\s+/g, "-").toLowerCase()}`}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {label}
                    </span>
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Map / location visual */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm min-h-[460px] relative">
            {/* Embedded Google Map fills the full card */}
            <iframe
              title="Dynamic Coaching Center Location"
              src="https://maps.google.com/maps?q=Dynamic+Coaching+Center,Bangladesh&output=embed&z=16&gesturehandling=none"
              className="absolute inset-0 w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              scrolling="no"
            />
            {/* Light overlay so text stays readable */}
            <div className="absolute inset-0 bg-white/40 pointer-events-none" />
            {/* Content on top */}
            <div className="relative z-10 flex flex-col items-center justify-end h-full pb-8 px-8 text-center min-h-[460px]">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg px-6 py-5 flex flex-col items-center gap-3 border border-slate-100">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-md">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-base">Dynamic Coaching Center</div>
                  <div className="text-slate-500 text-xs mt-0.5">Khotija Bhavan, Jaldi, Banskhali, Chattogram</div>
                </div>
                <a
                  href="https://maps.app.goo.gl/kzRgRt53jRugxgi66"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-google-maps"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-md"
                >
                  <MapPin className="w-4 h-4" /> Open in Google Maps
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER ────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="bg-slate-900 text-white pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20">
                <img src={coachingLogo} alt="DCC Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-black text-white text-lg leading-none">DCC</div>
                <div className="text-slate-400 text-[10px] leading-none tracking-wide">Dynamic CoachingCenters Center</div>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              Empowering students to achieve academic excellence and build a brighter future since 2020.
            </p>
            {/* Newsletter */}
            <div className="flex items-center gap-2">
              <input
                placeholder="Your Email Address"
                data-testid="input-newsletter-email"
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-400 transition-colors"
              />
              <button
                data-testid="button-newsletter-subscribe"
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors"
              >
                Subscribe
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h5 className="font-bold text-white text-sm mb-5 uppercase tracking-wide">Quick Links</h5>
            <ul className="space-y-2.5 text-slate-400 text-sm">
              {[
                { label: "Home", href: "#home" },
                { label: "About Us", href: "#about" },
                { label: "Programs", href: "#portals" },
                { label: "Teachers", href: "#teachers" },
                { label: "Alumni", href: "#alumni" },
                { label: "Contact", href: "#contact" },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3 opacity-50" />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Portals */}
          <div>
            <h5 className="font-bold text-white text-sm mb-5 uppercase tracking-wide">Portals</h5>
            <ul className="space-y-2.5 text-slate-400 text-sm">
              {[
                { label: "Student Portal", href: "/student" },
                { label: "Teacher Panel", href: "/teacher" },
                { label: "Authority Access", href: "/admin" },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="hover:text-blue-400 transition-colors flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3 opacity-50" />
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h5 className="font-bold text-white text-sm mb-5 uppercase tracking-wide">Contact Info</h5>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>Khotija Bhavan, Opposite of Land Office<br />(Lane beside Shahid Computer)<br />Jaldi, Banshkhali, Chattogram</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <a href="mailto:dynamicoachingcenter@gmail.com" className="hover:text-blue-400 transition-colors">
                  dynamicoachingcenter@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  {["01814-362956", "01306-743336", "01538-255904"].map((num) => (
                    <a key={num} href={`tel:${num.replace(/-/g, "")}`} className="hover:text-blue-400 transition-colors">{num}</a>
                  ))}
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
          <p>© {new Date().getFullYear()} Dynamic Coaching Center. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-white transition-colors">Terms & Conditions</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Contact Us</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── PAGE ──────────────────────────────────────────────────── */

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { canInstall, install } = usePWA();

  const navigate = (path: string) => setLocation(path);

  const handleInstall = async (preferredRoute: string) => {
    await install(preferredRoute);
  };

  return (
    <div className="min-h-screen font-sans overflow-x-hidden">
      <Header onNavigate={navigate} />
      <HeroSection onNavigate={navigate} />
      <PortalsSection
        onNavigate={navigate}
        onInstall={handleInstall}
        canInstall={canInstall}
      />
      <AboutSection />
      <TeachersSection />
      <ResultsSection />
      <AlumniSection />
      <ContactSection />
      <Footer />
    </div>
  );
}
