import { LoadingState } from "@/components/ui/EmptyState";

export default function ProfilLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <LoadingState label="Memuat profil" />
    </div>
  );
}
