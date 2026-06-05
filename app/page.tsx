import LanguagePieChart from "./components/LanguagePieChart";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-8 text-[#f0f6fc] md:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">GitHub Stats</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8b949e]">
            Generate a language usage card for your GitHub profile README.
          </p>
        </div>
        <LanguagePieChart />
      </div>
    </main>
  );
}
