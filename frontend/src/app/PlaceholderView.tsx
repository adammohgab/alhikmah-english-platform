export function PlaceholderView({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-text-primary text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-text-secondary mt-2">Al-Hikmah English Learning Platform</p>
    </div>
  );
}
