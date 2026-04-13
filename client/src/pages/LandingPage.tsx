import { useLocation } from "wouter";
import {
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Star,
  MapPin,
  Phone,
  Mail,
  Target,
  Eye,
  Award,
  Users,
  TrendingUp,
  ChevronRight,
  Sparkles,
  Quote,
  CheckCircle2,
  BookMarked,
  FlaskConical,
  Calculator,
  Globe,
} from "lucide-react";

const teachers = [
  {
    name: "Md. Rafiqul Islam",
    designation: "Senior Faculty",
    subject: "Higher Mathematics",
    icon: Calculator,
    color: "from-blue-500 to-indigo-600",
    initials: "RI",
  },
  {
    name: "Nusrat Jahan",
    designation: "Lead Instructor",
    subject: "Physics & Chemistry",
    icon: FlaskConical,
    color: "from-violet-500 to-purple-600",
    initials: "NJ",
  },
  {
    name: "Arif Hossain",
    designation: "Senior Faculty",
    subject: "English Literature",
    icon: BookMarked,
    color: "from-sky-500 to-blue-600",
    initials: "AH",
  },
  {
    name: "Taslima Akter",
    designation: "Core Instructor",
    subject: "Biology & Science",
    icon: Globe,
    color: "from-emerald-500 to-teal-600",
    initials: "TA",
  },
  {
    name: "Shahadat Hossain",
    designation: "Senior Faculty",
    subject: "Bangla & Social Science",
    icon: BookOpen,
    color: "from-orange-500 to-amber-600",
    initials: "SH",
  },
  {
    name: "Farida Begum",
    designation: "Lead Instructor",
    subject: "ICT & Mathematics",
    icon: Calculator,
    color: "from-pink-500 to-rose-600",
    initials: "FB",
  },
];

const alumni = [
  {
    name: "Sadia Islam",
    achievement: "GPA 5.00 – SSC 2024",
    admission: "Dhaka Medical College",
    testimonial: "DCC's structured teaching and mock tests gave me the confidence to achieve a perfect GPA. I am forever grateful!",
    batch: "Batch 2022–24",
    initials: "SI",
    color: "from-blue-400 to-indigo-500",
  },
  {
    name: "Mehedi Hasan",
    achievement: "GPA 5.00 – HSC 2024",
    admission: "BUET (Engineering)",
    testimonial: "The teachers here are incredibly dedicated. Their individual attention and problem-solving sessions made all the difference.",
    batch: "Batch 2022–24",
    initials: "MH",
    color: "from-violet-400 to-purple-500",
  },
  {
    name: "Fatema Tuj Zohora",
    achievement: "GPA 5.00 – SSC 2023",
    admission: "Rajshahi University",
    testimonial: "DCC is not just a coaching center — it's a family. The environment here pushed me to give my absolute best every day.",
    batch: "Batch 2021–23",
    initials: "FZ",
    color: "from-emerald-400 to-teal-500",
  },
  {
    name: "Raiyan Ahmed",
    achievement: "GPA 4.92 – HSC 2023",
    admission: "Chittagong University",
    testimonial: "The mock tests and result tracking system at DCC kept me focused and well-prepared throughout my academic journey.",
    batch: "Batch 2021–23",
    initials: "RA",
    color: "from-amber-400 to-orange-500",
  },
];

const stats = [
  { value: "500+", label: "Students Enrolled" },
  { value: "98%", label: "Pass Rate" },
  { value: "120+", label: "GPA 5.00 Achievers" },
  { value: "8+", label: "Years of Excellence" },
];

const features = [
  "Expert & experienced faculty for every subject",
  "Regular mock tests and model exams",
  "Individual student performance tracking",
  "Small batch sizes for focused attention",
  "Monthly parent-teacher meetings",
  "Digital result & payment management",
];

export default function LandingPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-black text-slate-900 text-lg tracking-tight">DCC</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#about" className="hover:text-indigo-600 transition-colors">About</a>
            <a href="#teachers" className="hover:text-indigo-600 transition-colors">Teachers</a>
            <a href="#alumni" className="hover:text-indigo-600 transition-colors">Wall of Fame</a>
            <a href="#contact" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
          <button
            data-testid="button-nav-student-login"
            onClick={() => setLocation("/student")}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            Student Login
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 pt-16">
        {/* Background decorative orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white/90 text-sm font-medium mb-8 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Come to Learn, Leave to Shine
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>

          {/* Main Heading */}
          <h1 className="font-display font-black text-white text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-none mb-6">
            Dynamic Coaching
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300">
              Center (DCC)
            </span>
          </h1>

          <p className="text-blue-100/80 text-lg sm:text-xl max-w-2xl mx-auto mb-4 leading-relaxed">
            Nurturing academic excellence with a student-first approach. Join hundreds of successful students who transformed their futures with DCC.
          </p>
          <p className="text-blue-200/60 text-base max-w-xl mx-auto mb-12">
            SSC & HSC preparation · Expert Faculty · Proven Results
          </p>

          {/* Stats Row */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 mb-16">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display font-black text-3xl sm:text-4xl text-white">{s.value}</div>
                <div className="text-blue-200/70 text-xs sm:text-sm mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── PORTAL CARDS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {/* Student Portal */}
            <button
              data-testid="button-portal-student"
              onClick={() => setLocation("/student")}
              className="group relative p-7 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md text-left hover:bg-white/20 hover:border-white/40 hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display font-bold text-white text-xl mb-2">Student Portal</h3>
              <p className="text-blue-100/70 text-sm leading-relaxed">View your results, payment history, and academic progress in one place.</p>
              <div className="flex items-center gap-1 mt-4 text-blue-300 text-sm font-medium group-hover:gap-2 transition-all">
                Login <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* Teacher Panel */}
            <button
              data-testid="button-portal-teacher"
              onClick={() => setLocation("/teacher")}
              className="group relative p-7 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md text-left hover:bg-white/20 hover:border-white/40 hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display font-bold text-white text-xl mb-2">Teacher Panel</h3>
              <p className="text-blue-100/70 text-sm leading-relaxed">Manage admissions, record marks, and track student payments seamlessly.</p>
              <div className="flex items-center gap-1 mt-4 text-blue-300 text-sm font-medium group-hover:gap-2 transition-all">
                Login <ChevronRight className="w-4 h-4" />
              </div>
            </button>

            {/* Authority Access */}
            <button
              data-testid="button-portal-admin"
              onClick={() => setLocation("/admin")}
              className="group relative p-7 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md text-left hover:bg-white/20 hover:border-white/40 hover:scale-105 hover:-translate-y-1 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-2xl"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-display font-bold text-white text-xl mb-2">Authority Access</h3>
              <p className="text-blue-100/70 text-sm leading-relaxed">Full dashboard control — manage teachers, finances, data, and insights.</p>
              <div className="flex items-center gap-1 mt-4 text-blue-300 text-sm font-medium group-hover:gap-2 transition-all">
                Login <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold uppercase tracking-wider mb-6">
                <BookOpen className="w-3.5 h-3.5" />
                About Our Coaching
              </div>
              <h2 className="font-display font-black text-slate-900 text-4xl sm:text-5xl mb-6 leading-tight">
                Building Futures,<br />
                <span className="text-indigo-600">One Student at a Time</span>
              </h2>
              <p className="text-slate-600 text-base leading-relaxed mb-6">
                Dynamic Coaching Center (DCC) was founded with a singular mission: to make quality education accessible and impactful for every student. We combine experienced faculty, structured curriculum, and a supportive environment to unlock each student's true potential.
              </p>
              <p className="text-slate-600 text-base leading-relaxed mb-8">
                From SSC to HSC, our comprehensive programs cover all major subjects with a focus on conceptual clarity, regular assessment, and personalized attention. We don't just teach — we mentor, motivate, and guide.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                {/* Mission */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-display font-bold text-slate-900 text-base mb-2">Our Mission</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">To deliver exceptional academic coaching that empowers every student to achieve their full potential.</p>
                </div>
                {/* Vision */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mb-3">
                    <Eye className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h4 className="font-display font-bold text-slate-900 text-base mb-2">Our Vision</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">To be the region's most trusted and results-driven coaching center for SSC and HSC students.</p>
                </div>
              </div>

              {/* Feature checklist */}
              <ul className="space-y-3">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-slate-700 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Image placeholder */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl" />
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-700 aspect-[4/3] flex flex-col items-center justify-center shadow-2xl">
                {/* Decorative elements inside */}
                <div className="absolute top-6 left-6 right-6 flex gap-3">
                  <div className="flex-1 h-2 rounded-full bg-white/20" />
                  <div className="flex-1 h-2 rounded-full bg-white/10" />
                  <div className="w-12 h-2 rounded-full bg-white/10" />
                </div>
                <div className="text-center px-8">
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
                    <GraduationCap className="w-10 h-10 text-white" />
                  </div>
                  <div className="font-display font-black text-white text-2xl mb-2">DCC Campus</div>
                  <div className="text-blue-200 text-sm">Where Excellence Begins</div>
                </div>
                {/* Decorative circles */}
                <div className="absolute bottom-8 left-8 w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                  <Award className="w-7 h-7 text-white/80" />
                </div>
                <div className="absolute top-8 right-8 w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                  <Star className="w-6 h-6 text-amber-300" />
                </div>
                {/* Stats badges */}
                <div className="absolute bottom-6 right-6 bg-white rounded-xl px-3 py-2 shadow-lg">
                  <div className="font-display font-black text-indigo-700 text-lg">98%</div>
                  <div className="text-slate-500 text-xs">Pass Rate</div>
                </div>
              </div>
              {/* Floating achievement card */}
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl px-5 py-4 border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="font-display font-bold text-slate-900 text-sm">120+ GPA 5.00</div>
                  <div className="text-slate-500 text-xs">Students in 2024</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TEACHERS ── */}
      <section id="teachers" className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-600 text-xs font-semibold uppercase tracking-wider mb-5">
              <Users className="w-3.5 h-3.5" />
              Expert Faculty
            </div>
            <h2 className="font-display font-black text-slate-900 text-4xl sm:text-5xl mb-4">
              Meet Our <span className="text-indigo-600">Expert Teachers</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
              Passionate educators with years of experience dedicated to your academic success.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map((teacher) => {
              const Icon = teacher.icon;
              return (
                <div
                  key={teacher.name}
                  data-testid={`card-teacher-${teacher.name.replace(/\s+/g, "-").toLowerCase()}`}
                  className="group p-6 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default"
                >
                  {/* Avatar */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${teacher.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform duration-300 shadow-md`}>
                    <span className="font-display font-black text-white text-lg">{teacher.initials}</span>
                  </div>
                  <h3 className="font-display font-bold text-slate-900 text-lg mb-1">{teacher.name}</h3>
                  <div className="text-indigo-600 text-xs font-semibold uppercase tracking-wider mb-2">{teacher.designation}</div>
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    {teacher.subject}
                  </div>
                  {/* Subtle divider + stars */}
                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                    <span className="text-slate-400 text-xs ml-1">Expert</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ALUMNI WALL OF FAME ── */}
      <section id="alumni" className="py-24 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 relative overflow-hidden">
        <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-5">
              <Award className="w-3.5 h-3.5" />
              Kriti Shikkharthi
            </div>
            <h2 className="font-display font-black text-white text-4xl sm:text-5xl mb-4">
              Alumni &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300">Success Stories</span>
            </h2>
            <p className="text-blue-200/70 text-lg max-w-xl mx-auto">
              Our Wall of Fame celebrates the extraordinary achievers who made DCC proud.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {alumni.map((student) => (
              <div
                key={student.name}
                data-testid={`card-alumni-${student.name.replace(/\s+/g, "-").toLowerCase()}`}
                className="group p-6 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md hover:bg-white/15 hover:border-white/30 hover:-translate-y-1 transition-all duration-300"
              >
                {/* Avatar */}
                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${student.color} flex items-center justify-center mx-auto mb-4 shadow-lg border-2 border-white/20 group-hover:scale-105 transition-transform duration-300`}>
                  <span className="font-display font-black text-white text-base">{student.initials}</span>
                </div>

                {/* Achievement badge */}
                <div className="flex items-center justify-center gap-1 mb-3">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-amber-300 text-xs font-bold">{student.achievement}</span>
                </div>

                <h3 className="font-display font-bold text-white text-base text-center mb-1">{student.name}</h3>
                <div className="text-blue-200/70 text-xs text-center mb-4 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {student.admission}
                </div>

                {/* Testimonial */}
                <div className="relative">
                  <Quote className="w-5 h-5 text-white/20 absolute -top-1 -left-1" />
                  <p className="text-blue-100/70 text-xs leading-relaxed pl-4 italic">
                    "{student.testimonial}"
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 text-center">
                  <span className="text-white/40 text-xs">{student.batch}</span>
                </div>
              </div>
            ))}
          </div>

          {/* CTA strip */}
          <div className="mt-16 text-center">
            <p className="text-blue-200/70 text-base mb-6">Ready to write your own success story?</p>
            <button
              data-testid="button-alumni-student-portal"
              onClick={() => setLocation("/student")}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-indigo-700 font-semibold text-sm hover:bg-blue-50 transition-colors shadow-xl"
            >
              <GraduationCap className="w-4 h-4" />
              Access Student Portal
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── CONTACT & LOCATION ── */}
      <section id="contact" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold uppercase tracking-wider mb-5">
              <MapPin className="w-3.5 h-3.5" />
              Find Us
            </div>
            <h2 className="font-display font-black text-slate-900 text-4xl sm:text-5xl mb-4">
              Contact &amp; <span className="text-indigo-600">Location</span>
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Come visit us or reach out — we're always happy to help students and parents.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Contact Info */}
            <div className="space-y-5">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-base mb-1">Address</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">Dynamic Coaching Center<br />Main Road, Upazila Area<br />District, Bangladesh</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-base mb-1">Phone</h4>
                  <p className="text-slate-600 text-sm">+880 1XXX-XXXXXX</p>
                  <p className="text-slate-500 text-xs mt-1">Available: Sat–Thu, 9 AM – 7 PM</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-900 text-base mb-1">Email</h4>
                  <p className="text-slate-600 text-sm">info@dynamiccoachingcenter.edu.bd</p>
                  <p className="text-slate-500 text-xs mt-1">We respond within 24 hours</p>
                </div>
              </div>

              {/* Portal quick links */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white">
                <h4 className="font-display font-bold text-lg mb-4">Quick Portal Access</h4>
                <div className="space-y-3">
                  {[
                    { label: "Student Portal", path: "/student", icon: GraduationCap },
                    { label: "Teacher Panel", path: "/teacher", icon: BookOpen },
                    { label: "Authority Access", path: "/admin", icon: ShieldCheck },
                  ].map(({ label, path, icon: Icon }) => (
                    <button
                      key={path}
                      data-testid={`button-contact-${label.replace(/\s+/g, "-").toLowerCase()}`}
                      onClick={() => setLocation(path)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-white/15 hover:bg-white/25 transition-colors text-sm font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                      <ChevronRight className="w-4 h-4 opacity-70" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 min-h-[480px] flex flex-col">
              <div className="flex-1 bg-gradient-to-br from-slate-100 to-blue-50 flex flex-col items-center justify-center relative">
                {/* Simulated map grid */}
                <div
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />
                <div className="relative z-10 text-center px-8">
                  <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-xl animate-pulse">
                    <MapPin className="w-8 h-8 text-white" />
                  </div>
                  <div className="font-display font-bold text-slate-700 text-xl mb-2">Dynamic Coaching Center</div>
                  <div className="text-slate-500 text-sm mb-6">Main Road, Upazila Area, Bangladesh</div>
                  <a
                    href="https://maps.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="link-google-maps"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md"
                  >
                    <MapPin className="w-4 h-4" />
                    Open in Google Maps
                  </a>
                </div>
                {/* Decorative road lines */}
                <div className="absolute bottom-16 left-0 right-0 h-0.5 bg-slate-300/50" />
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-300/50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-display font-black text-white text-base">Dynamic Coaching Center</div>
                <div className="text-slate-400 text-xs">Come to Learn, Leave to Shine</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-slate-400 text-sm">
              <button onClick={() => setLocation("/student")} className="hover:text-white transition-colors">Student Login</button>
              <button onClick={() => setLocation("/teacher")} className="hover:text-white transition-colors">Teacher Login</button>
              <button onClick={() => setLocation("/admin")} className="hover:text-white transition-colors">Admin Login</button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-slate-500 text-xs">
            © {new Date().getFullYear()} Dynamic Coaching Center. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
