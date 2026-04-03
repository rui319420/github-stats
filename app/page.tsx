import LanguagePieChart from "@/components/LanguagePieChart";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0d1117] flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-[#F2F3F5] mb-6">GitHub Stats</h1>
        <LanguagePieChart />
      </div>
    </main>
  );
}