import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#E8ECF4] font-[Inter,sans-serif] flex flex-col items-center justify-center p-8">
      <h1 className="font-[Space_Grotesk,sans-serif] font-bold text-4xl tracking-tight mb-2">
        <span className="text-[#00D4AA]">JEV</span> Decision Demos
      </h1>
      <p className="text-sm text-[#8B95A8] mb-12 max-w-[480px] text-center leading-relaxed">
        Demonstrações interativas do modelo JEV da TypeSafe — decisões estruturadas, tipadas e com probabilidades calibradas em tempo real.
      </p>

      <div className="flex gap-6 flex-wrap justify-center max-w-[700px]">
        <Link
          href="/snake"
          className="group w-[300px] bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded-lg p-6 hover:border-[#00D4AA] transition-colors cursor-pointer"
        >
          <div className="font-[Space_Grotesk,sans-serif] text-lg font-semibold mb-2 group-hover:text-[#00D4AA] transition-colors">
            Snake Game
          </div>
          <p className="text-xs text-[#8B95A8] leading-relaxed">
            Jogo da cobrinha onde cada movimento é decidido pelo JEV via primitivo Choice. Visualize probabilidades calibradas e latência em tempo real.
          </p>
        </Link>

        <Link
          href="/identity"
          className="group w-[300px] bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded-lg p-6 hover:border-[#00D4AA] transition-colors cursor-pointer"
        >
          <div className="font-[Space_Grotesk,sans-serif] text-lg font-semibold mb-2 group-hover:text-[#00D4AA] transition-colors">
            Identity Matcher
          </div>
          <p className="text-xs text-[#8B95A8] leading-relaxed">
            Classificação de identidade única entre sistemas usando Choice e múltiplos Noul em paralelo. Problema real de matching com decisão tipada.
          </p>
        </Link>
      </div>

      <div className="mt-16 text-[0.65rem] text-[#8B95A8] font-[JetBrains_Mono,monospace]">
        API: POST /api/jev → api.typesafe.ai/v1/systemone · Modelo: jev-latest
      </div>
    </div>
  );
}