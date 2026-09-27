import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BranchCardProps = {
  branch: {
    id: string;
    name: string;
    branchNumber: number;
    coverImageUrl: string | null;
    rootPerson: { fullName: string } | null;
    _count: { members: number };
  };
  className?: string;
};

export function BranchCard({ branch, className }: BranchCardProps) {
  const memberCount = branch._count.members;
  const isEmpty = memberCount === 0;
  const isPlaceholder = !branch.coverImageUrl;

  return (
    <Link
      href={`/silsilah?branchId=${encodeURIComponent(branch.id)}`}
      className={cn(
        "group block h-full rounded-lg border border-wood/20 bg-cream transition-all duration-300",
        "hover:-translate-y-1 hover:border-gold/60 hover:shadow-lg hover:shadow-wood/15",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2",
        className
      )}
      aria-label={`Lihat silsilah cabang ${branch.name}, ${memberCount} anggota`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-parchment">
        <Image
          src={branch.coverImageUrl || "/images/branch-placeholder.svg"}
          alt={isPlaceholder ? "Foto default" : ""}
          fill
          unoptimized={isPlaceholder}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(min-width: 1200px) 20vw, (min-width: 768px) 33vw, 50vw"
        />
        {isPlaceholder && (
          <span className="absolute bottom-3 left-3 rounded-sm bg-ink/75 px-2 py-1 text-xs font-medium text-cream">
            Foto default
          </span>
        )}
        <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold-deep/90 backdrop-blur-sm">
          <span className="font-display text-lg font-semibold text-cream">
            {String(branch.branchNumber).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-display text-xl font-semibold text-forest">
          {branch.name}
        </h3>
        {branch.rootPerson && (
          <p className="mt-1.5 text-sm text-muted">
            Berakar dari {branch.rootPerson.fullName}
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {isEmpty ? (
            <span className="italic">Belum ada anggota tercatat</span>
          ) : (
            `${memberCount} anggota tercatat`
          )}
        </p>
      </div>
    </Link>
  );
}
