import { useQuery } from "@tanstack/react-query";
import { Phone, BookOpen, GraduationCap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Layout } from "@/components/Layout";
import { type User } from "@/lib/schemas";

function TeacherCard({ teacher }: { teacher: User }) {
  const initials = teacher.name
    ? teacher.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "TC";

  return (
    <div
      data-testid={`card-teacher-${teacher.id}`}
      className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-4 p-5">
        {/* Avatar */}
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md shadow-blue-100">
          <span className="text-white font-black text-lg tracking-wide">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p data-testid={`text-teacher-name-${teacher.id}`} className="font-bold text-slate-800 text-base leading-snug truncate">
            {teacher.name || teacher.username}
          </p>
          {teacher.subject && (
            <div className="flex items-center gap-1.5 mt-1">
              <BookOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span data-testid={`text-teacher-subject-${teacher.id}`} className="text-xs text-slate-500 font-medium truncate">
                {teacher.subject}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-slate-100" />

      {/* Call button */}
      <div className="px-5 py-4">
        {teacher.mobileNumber ? (
          <a
            href={`tel:${teacher.mobileNumber}`}
            data-testid={`link-call-teacher-${teacher.id}`}
            className="flex items-center justify-between w-full group"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors"
              >
                <Phone className="w-4 h-4 text-green-600" strokeWidth={2} />
              </span>
              <span
                data-testid={`text-teacher-mobile-${teacher.id}`}
                className="text-sm font-semibold text-slate-700 group-hover:text-green-700 transition-colors tracking-wide"
              >
                {teacher.mobileNumber}
              </span>
            </div>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl group-hover:bg-green-100 transition-colors">
              Call Now
            </span>
          </a>
        ) : (
          <div className="flex items-center gap-2.5 opacity-40">
            <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Phone className="w-4 h-4 text-slate-400" strokeWidth={2} />
            </span>
            <span className="text-sm text-slate-400 font-medium">Number not available</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-5">
        <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36 rounded-lg" />
          <Skeleton className="h-3 w-24 rounded-lg" />
        </div>
      </div>
      <div className="mx-5 border-t border-slate-100" />
      <div className="px-5 py-4">
        <Skeleton className="h-8 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function TeacherDirectory() {
  const { data: teachers, isLoading, isError } = useQuery<User[]>({
    queryKey: ["/api/teachers"],
  });

  return (
    <Layout>
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-100">
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Teacher Directory</h1>
          </div>
          <p className="text-sm text-slate-500 ml-[52px]">Tap a number to call your teacher directly</p>
        </div>

        {/* Cards */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {isError && (
          <div className="text-center py-16 text-slate-400">
            <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Could not load teachers</p>
            <p className="text-xs mt-1">Please try again later</p>
          </div>
        )}

        {!isLoading && !isError && teachers && teachers.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No teachers found</p>
          </div>
        )}

        {!isLoading && !isError && teachers && teachers.length > 0 && (
          <div className="space-y-3">
            {teachers.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
