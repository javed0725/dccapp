import { useLocation } from "wouter";
import {
  GraduationCap,
  ShieldCheck,
  Search,
  ArrowRight,
  Star,
  MapPin,
  Phone,
  Mail,
  BookOpen,
  Users,
  Award,
  TrendingUp,
  Quote,
  Video,
  LayoutGrid,
  UserCheck,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import coachingLogo from "@assets/IMG_20260126_081644_1769393818079.jpg";

/* ─── DATA ─────────────────────────────────────────────────── */

const navLinks = ["Home", "About", "Teachers", "Alumni", "Contact"];

const partners = [
  "Logoipsum",
  "Logoipsum",
  "Logoipsum",
  "Logoipsum",
  "Logoipsum",
];

const portals = [
  {
    icon: GraduationCap,
    title: "Student Portal",
    subtitle: "View Results & Payments",
    desc: "Access your payment history, academic results, and account status from a single dashboard.",
    path: "/student",
    color: "text-red-500",
    bg: "bg-red-50",
  },
  {
    icon: LayoutGrid,
    title: "Teacher Panel",
    subtitle: "Manage Admissions & Marks",
    desc: "Handle student admissions, record exam marks, and track monthly payments efficiently.",
    path: "/teacher",
    color: "text-red-500",
    bg: "bg-red-50",
  },
  {
    icon: ShieldCheck,
    title: "Authority Access",
    subtitle: "Full Admin Control",
    desc: "Complete oversight of finances, batches, teacher management, and system analytics.",
    path: "/admin",
    color: "text-red-500",
    bg: "bg-red-50",
  },
];

const aboutFeatures = [
  "Expert faculty for every subject",
  "Regular mock tests & model exams",
  "Personal performance tracking",
  "Small batch sizes for focused learning",
];

const alumni = [
  {
    name: "Sadia Islam",
    achievement: "GPA 5.00 — SSC 2024",
    university: "Dhaka Medical College",
    batch: "Batch 2022–24",
    quote: "DCC's structured teaching and mock tests gave me the confidence to achieve a perfect GPA.",
    initials: "SI",
    color: "bg-yellow-400",
  },
  {
    name: "Mehedi Hasan",
    achievement: "GPA 5.00 — HSC 2024",
    university: "BUET (Engineering)",
    batch: "Batch 2022–24",
    quote: "The teachers here are incredibly dedicated. Their individual attention made all the difference.",
    initials: "MH",
    color: "bg-red-400",
  },
  {
    name: "Fatema Tuj Zohora",
    achievement: "GPA 5.00 — SSC 2023",
    university: "Rajshahi University",
    batch: "Batch 2021–23",
    quote: "DCC is not just a coaching center — it's a family. The environment pushed me to be my best.",
    initials: "FZ",
    color: "bg-blue-400",
  },
  {
    name: "Raiyan Ahmed",
    achievement: "GPA 4.92 — HSC 2023",
    university: "Chittagong University",
    batch: "Batch 2021–23",
    quote: "The mock tests and result tracking at DCC kept me focused throughout my academic journey.",
    initials: "RA",
    color: "bg-green-400",
  },
  {
    name: "Nusrat Jahan",
    achievement: "GPA 5.00 — SSC 2024",
    university: "Viqarunnisa Noon College",
    batch: "Batch 2022–24",
    quote: "I never imagined getting GPA 5 until DCC showed me exactly how to get there.",
    initials: "NJ",
    color: "bg-purple-400",
  },
  {
    name: "Arif Hossain",
    achievement: "GPA 4.83 — HSC 2023",
    university: "Dhaka University",
    batch: "Batch 2021–23",
    quote: "DCC's guidance helped me turn my weaknesses into strengths before the final exams.",
    initials: "AH",
    color: "bg-orange-400",
  },
];

/* ─── COMPONENTS ────────────────────────────────────────────── */

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        <img src={coachingLogo} alt="DCC Logo" className="w-full h-full object-cover" />
      </div>
      <span className="font-display font-black text-slate-900 text-xl tracking-tight">DCC</span>
    </div>
  );
}

/* ─── SECTIONS ──────────────────────────────────────────────── */

function Header({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#FFFBF2]/95 backdrop-blur-md border-b border-amber-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-slate-600 text-sm font-medium hover:text-red-500 transition-colors"
            >
              {link}
            </a>
          ))}
        </nav>
        <button
          data-testid="button-nav-get-in-touch"
          onClick={() => onNavigate("/student")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors shadow-sm"
        >
          Get In Touch <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

function HeroSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section
      id="home"
      className="pt-16 min-h-screen flex items-center bg-[#FFFBF2] relative overflow-hidden"
    >
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-[520px] h-[520px] rounded-full bg-yellow-300/30 translate-x-1/3 -translate-y-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-amber-100/60 -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left: Text */}
        <div>
          <h1 className="font-display font-black text-slate-900 text-5xl sm:text-6xl leading-[1.08] mb-5">
            Build Your<br />
            Future, Choose<br />
            <span className="text-red-500">Your Course</span>
          </h1>
          <p className="text-slate-500 text-base leading-relaxed mb-8 max-w-md">
            Dynamic Coaching Center — the academic school of the future. We teach you the right skills to be prepared for tomorrow.
          </p>

          {/* Search bar */}
          <div className="flex items-center gap-2 bg-white rounded-xl shadow-md border border-slate-100 p-2 max-w-md mb-10">
            <input
              data-testid="input-course-search"
              type="text"
              placeholder="Search By Courses..."
              className="flex-1 bg-transparent text-sm text-slate-600 placeholder:text-slate-400 outline-none px-3 py-1.5"
            />
            <button
              data-testid="button-search"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              <Search className="w-4 h-4" /> Search
            </button>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["bg-blue-400", "bg-amber-400", "bg-green-400"].map((c, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-white flex items-center justify-center`}>
                    <span className="text-white text-[10px] font-bold">{String.fromCharCode(65 + i)}</span>
                  </div>
                ))}
              </div>
              <div className="ml-1">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-500 text-xs mt-0.5">100k+ Reviews</p>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <div className="font-display font-black text-slate-900 text-xl">500+</div>
              <div className="text-slate-500 text-xs">Students Enrolled</div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div>
              <div className="font-display font-black text-slate-900 text-xl">98%</div>
              <div className="text-slate-500 text-xs">Pass Rate</div>
            </div>
          </div>
        </div>

        {/* Right: Student visual */}
        <div className="relative flex items-center justify-center">
          {/* Large yellow circle */}
          <div className="absolute w-[380px] h-[380px] sm:w-[440px] sm:h-[440px] rounded-full bg-yellow-300/50" />

          {/* Student illustration placeholder */}
          <div className="relative z-10 w-[320px] sm:w-[380px] h-[420px] sm:h-[480px] flex items-end justify-center">
            <div className="absolute inset-0 flex flex-col items-center justify-end">
              <div className="w-56 sm:w-64 h-72 sm:h-80 rounded-2xl bg-gradient-to-b from-amber-200 to-amber-100 flex items-end justify-center overflow-hidden shadow-xl">
                <div className="flex flex-col items-center justify-end h-full pb-0">
                  {/* Stylized student figure */}
                  <div className="relative">
                    {/* Head */}
                    <div className="w-16 h-16 rounded-full bg-amber-600 mx-auto mb-1 flex items-center justify-center border-4 border-amber-100">
                      <span className="text-white font-display font-black text-xl">DCC</span>
                    </div>
                    {/* Body with books */}
                    <div className="w-40 h-48 bg-red-500 rounded-t-3xl flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <BookOpen className="w-10 h-10 text-white/80" />
                        <span className="text-white/90 font-display font-bold text-sm text-center">Future<br />Scholar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <div className="absolute top-8 right-4 bg-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-2 border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <Award className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <div className="font-display font-bold text-slate-900 text-xs">120+ Students</div>
              <div className="text-slate-400 text-[10px]">GPA 5.00 Achievers</div>
            </div>
          </div>

          <div className="absolute bottom-16 right-0 bg-white rounded-2xl shadow-lg px-4 py-3 border border-slate-100">
            <div className="flex items-center gap-1 mb-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
            </div>
            <div className="text-slate-700 text-xs font-semibold">4.9 Rating</div>
            <div className="text-slate-400 text-[10px]">Based on 100k+ Reviews</div>
          </div>

          <div className="absolute top-24 left-0 bg-white rounded-2xl shadow-lg px-4 py-3 border border-slate-100 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <div className="font-display font-bold text-slate-900 text-xs">8+ Years</div>
              <div className="text-slate-400 text-[10px]">of Excellence</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PartnersSection() {
  return (
    <section className="bg-[#FFFBF2] border-t border-amber-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-16 opacity-50">
          {partners.map((name, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-500">
              <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">L</span>
              </div>
              <span className="font-display font-bold text-slate-600 text-sm">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortalsSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <button
                key={portal.path}
                data-testid={`button-portal-${portal.title.replace(/\s+/g, "-").toLowerCase()}`}
                onClick={() => onNavigate(portal.path)}
                className="group text-left p-7 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-2xl ${portal.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-7 h-7 ${portal.color}`} />
                </div>
                <h3 className="font-display font-bold text-slate-900 text-xl mb-1">{portal.title}</h3>
                <p className="text-red-500 text-xs font-semibold mb-3">{portal.subtitle}</p>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">{portal.desc}</p>
                <div className="flex items-center gap-1 text-red-500 text-sm font-semibold group-hover:gap-2 transition-all">
                  Login Now <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AboutSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          {/* Left: Image */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 aspect-[3/4] max-w-sm mx-auto lg:mx-0 shadow-xl">
              {/* Decorative pattern */}
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle, #f59e0b 1px, transparent 1px)", backgroundSize: "20px 20px" }}
              />
              {/* Student figure */}
              <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center border-4 border-white shadow-lg mb-0">
                    <Users className="w-9 h-9 text-white" />
                  </div>
                  <div className="w-full h-56 bg-gradient-to-b from-red-400 to-red-600 flex items-center justify-center rounded-t-3xl mt-3 px-8">
                    <div className="text-center">
                      <BookOpen className="w-12 h-12 text-white/80 mx-auto mb-3" />
                      <p className="text-white font-display font-bold text-base">Passionate Learner</p>
                      <p className="text-white/70 text-xs mt-1">Achieving excellence every day</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* "New" badge overlay */}
              <div className="absolute top-5 left-5 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                New
              </div>
              <div className="absolute top-12 left-5 bg-white/90 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl shadow-md max-w-[140px] leading-tight">
                Get 20% off in every courses
              </div>
            </div>

            {/* Floating card */}
            <div className="absolute -bottom-4 -right-4 lg:-right-8 bg-white rounded-2xl shadow-xl px-5 py-4 border border-slate-100 flex items-center gap-3 z-10">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="font-display font-bold text-slate-900 text-sm">120+ GPA 5.00</div>
                <div className="text-slate-500 text-xs">Students in 2024</div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div>
            <p className="text-red-500 text-sm font-semibold uppercase tracking-widest mb-3">About Us</p>
            <h2 className="font-display font-black text-slate-900 text-4xl sm:text-5xl leading-tight mb-5">
              About Our Next Level<br />
              <span className="text-red-500">E-Course For Everyone</span>
            </h2>
            <p className="text-slate-500 text-base leading-relaxed mb-6">
              E-learning allows learners to access course materials and complete assignments at their own pace and on their own schedule. This is particularly beneficial for adult learners who may have work or family commitments.
            </p>

            <ul className="space-y-3 mb-8">
              {aboutFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-slate-700 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-red-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {/* Create Account CTA */}
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100 mb-8">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h4 className="font-display font-bold text-slate-900 text-base mb-1">Creat Account</h4>
                <p className="text-slate-500 text-sm">E-learning eliminates the need for classroom.</p>
              </div>
            </div>

            <button
              data-testid="button-about-student-portal"
              onClick={() => onNavigate("/student")}
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors shadow-md"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function AlumniSection() {
  return (
    <section id="alumni" className="py-20 bg-[#FFFBF2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-red-500 text-sm font-semibold uppercase tracking-widest mb-3">Kriti Shikkharthi</p>
          <h2 className="font-display font-black text-slate-900 text-4xl sm:text-5xl mb-4">
            Wall of <span className="text-red-500">Fame</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Our proudest achievers who made DCC shine on the national stage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {alumni.map((student) => (
            <div
              key={student.name}
              data-testid={`card-alumni-${student.name.replace(/\s+/g, "-").toLowerCase()}`}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-6"
            >
              {/* Avatar row */}
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-full ${student.color} flex items-center justify-center border-4 border-white shadow-md`}>
                  <span className="font-display font-black text-white text-lg">{student.initials}</span>
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-base">{student.name}</h4>
                  <div className="flex items-center gap-1 mt-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Achievement */}
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-red-500 text-xs font-bold">{student.achievement}</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-600 text-xs font-medium">{student.university}</span>
              </div>

              {/* Testimonial */}
              <div className="relative pl-4 border-l-2 border-red-200">
                <p className="text-slate-500 text-sm leading-relaxed italic">"{student.quote}"</p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-50 text-slate-400 text-xs">
                {student.batch}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  return (
    <section id="contact" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-red-500 text-sm font-semibold uppercase tracking-widest mb-3">Find Us</p>
          <h2 className="font-display font-black text-slate-900 text-4xl sm:text-5xl mb-4">
            Contact & <span className="text-red-500">Location</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Come visit us or reach out — we're always happy to help students and parents.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact Info */}
          <div className="space-y-4">
            {[
              { icon: MapPin, label: "Address", value: "Dynamic Coaching Center\nMain Road, Upazila Area, Bangladesh", color: "bg-red-50 text-red-500" },
              { icon: Phone, label: "Phone", value: "+880 1XXX-XXXXXX\nAvailable: Sat–Thu, 9 AM – 7 PM", color: "bg-blue-50 text-blue-500" },
              { icon: Mail, label: "Email", value: "info@dynamiccoachingcenter.edu.bd\nWe respond within 24 hours", color: "bg-violet-50 text-violet-500" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color.split(" ")[0]}`}>
                  <Icon className={`w-5 h-5 ${color.split(" ")[1]}`} />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-sm mb-1">{label}</h4>
                  <p className="text-slate-500 text-sm whitespace-pre-line">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 min-h-[360px] flex flex-col relative">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: "linear-gradient(rgba(99,102,241,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.4) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative z-10 flex flex-col items-center justify-center flex-1 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4 shadow-xl">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <div className="font-display font-bold text-slate-700 text-xl mb-2">Dynamic Coaching Center</div>
              <div className="text-slate-500 text-sm mb-6">Main Road, Upazila Area, Bangladesh</div>
              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-google-maps"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors shadow-md"
              >
                <MapPin className="w-4 h-4" /> Open in Google Maps
              </a>
            </div>
            <div className="absolute bottom-16 left-0 right-0 h-px bg-slate-300/40" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-300/40" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <footer className="bg-[#1C1C1E] text-white pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/20">
                <img src={coachingLogo} alt="DCC Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-display font-black text-white text-lg">DCC</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              Make better future<br />for your Career
            </p>
            {/* Email sub */}
            <div className="flex items-center gap-2">
              <input placeholder="Your Email Address" className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-red-400 transition-colors" />
              <button className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
                Subscribe
              </button>
            </div>
          </div>

          {/* Academic Info */}
          <div>
            <h5 className="font-display font-bold text-white text-sm mb-4">Academic Info</h5>
            <ul className="space-y-2 text-slate-400 text-sm">
              {["Home", "About Us", "Teachers", "Alumni", "Blog", "Contact"].map((item) => (
                <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h5 className="font-display font-bold text-white text-sm mb-4">Categories</h5>
            <ul className="space-y-2 text-slate-400 text-sm">
              {["Development", "UX/UI Design", "Technology", "Mathematics", "Science", "English"].map((item) => (
                <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h5 className="font-display font-bold text-white text-sm mb-4">Contact Info</h5>
            <ul className="space-y-3 text-slate-400 text-sm">
              <li className="flex items-start gap-2"><MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />Main Road, Upazila Area, Bangladesh</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-red-400 shrink-0" />info@dcc.edu.bd</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-red-400 shrink-0" />+880 1XXX-XXXXXX</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-xs">
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

  const navigate = (path: string) => setLocation(path);

  return (
    <div className="min-h-screen font-sans overflow-x-hidden">
      <Header onNavigate={navigate} />
      <HeroSection onNavigate={navigate} />
      <PartnersSection />
      <PortalsSection onNavigate={navigate} />
      <AboutSection onNavigate={navigate} />
      <AlumniSection />
      <ContactSection />
      <Footer onNavigate={navigate} />
    </div>
  );
}
