'use client';

import { useState } from 'react';

interface Record {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNasc: string;
  cidade: string;
}

interface Scenario {
  desc: string;
  a: Record;
  b: Record;
}

const SCENARIOS: Record<string, Scenario> = {
  exact: {
    desc: 'Mesma pessoa, dados idênticos nos dois sistemas. Caso trivial para validar o baseline.',
    a: { nome: 'Ana Carolina Silva', cpf: '123.456.789-00', email: 'ana.silva@email.com', telefone: '(11) 98765-4321', dataNasc: '1990-03-15', cidade: 'São Paulo' },
    b: { nome: 'Ana Carolina Silva', cpf: '123.456.789-00', email: 'ana.silva@email.com', telefone: '(11) 98765-4321', dataNasc: '1990-03-15', cidade: 'São Paulo' },
  },
  fuzzy: {
    desc: 'Mesma pessoa com variações comuns: nome abreviado, email diferente, telefone atualizado.',
    a: { nome: 'Carlos Eduardo Mendes', cpf: '987.654.321-00', email: 'carlos.mendes@corp.com', telefone: '(21) 99876-5432', dataNasc: '1985-07-22', cidade: 'Rio de Janeiro' },
    b: { nome: 'Carlos E. Mendes', cpf: '987.654.321-00', email: 'c.mendes@gmail.com', telefone: '(21) 98765-4321', dataNasc: '1985-07-22', cidade: 'Rio de Janeiro' },
  },
  different: {
    desc: 'Pessoas diferentes com nomes parecidos. Sem CPF em comum, emails e telefones distintos.',
    a: { nome: 'Maria Fernanda Lima', cpf: '111.222.333-44', email: 'maria.lima@email.com', telefone: '(31) 97654-3210', dataNasc: '1992-11-08', cidade: 'Belo Horizonte' },
    b: { nome: 'Maria Fernanda Lima', cpf: '555.666.777-88', email: 'mf.lima@outro.com', telefone: '(41) 98888-7777', dataNasc: '1988-04-19', cidade: 'Curitiba' },
  },
  typo: {
    desc: 'Mesma pessoa com erro de digitação no nome. Testa robustez do modelo contra dados sujos.',
    a: { nome: 'Roberto Alves da Costa', cpf: '234.567.890-12', email: 'roberto.costa@email.com', telefone: '(51) 96543-2109', dataNasc: '1978-09-30', cidade: 'Porto Alegre' },
    b: { nome: 'Robrto Alves da Costa', cpf: '234.567.890-12', email: 'roberto.costa@email.com', telefone: '(51) 96543-2109', dataNasc: '1978-09-30', cidade: 'Porto Alegre' },
  },
};

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome Completo',
  cpf: 'CPF',
  email: 'E-mail',
  telefone: 'Telefone',
  dataNasc: 'Data de Nascimento',
  cidade: 'Cidade',
};

interface JevResult {
  decision: string;
  confidence: number;
  probabilities: Record<string, number>;
  factors: { field: string; noul: number }[];
  latencyMs: string;
  model: string;
  raw: unknown;
}

export default function IdentityPage() {
  const [apiKey, setApiKey] = useState('');
  const [scenarioKey, setScenarioKey] = useState<string>('exact');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<JevResult | null>(null);

  const scenario = SCENARIOS[scenarioKey];

  const callJev = async () => {
    if (!apiKey.trim()) {
      setError('Cole sua API key acima antes de testar');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    const start = performance.now();
    const stateText = `Record A (CRM): ${JSON.stringify(scenario.a)}\nRecord B (ERP): ${JSON.stringify(scenario.b)}\nTask: Determine if these two records refer to the same person.`;

    try {
      const response = await fetch('/api/jev', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'jev-latest',
          state: stateText,
          questions: {
            same_person: {
              type: 'choice',
              instructions: 'Do these two records refer to the same person?',
              criteria: {
                MESMA_PESSOA: 'Both records describe the same individual — matching identifiers or strong corroborating evidence',
                PESSOAS_DIFERENTES: 'The records clearly describe different people — conflicting identifiers or no meaningful overlap',
                INCONCLUSIVO: 'Insufficient or contradictory evidence to make a confident determination',
              },
            },
            name_match: { type: 'noul', instructions: 'The names in both records refer to the same person (accounting for abbreviations, typos, and variations)' },
            cpf_match: { type: 'noul', instructions: 'The CPF/tax ID values in both records are consistent with being the same person' },
            email_match: { type: 'noul', instructions: 'The email addresses in both records likely belong to the same person' },
            phone_match: { type: 'noul', instructions: 'The phone numbers in both records likely belong to the same person' },
            dob_match: { type: 'noul', instructions: 'The dates of birth in both records are consistent with being the same person' },
          },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API ${response.status}: ${err}`);
      }

      const data = await response.json();
      const latency = (performance.now() - start).toFixed(1);
      const mainAnswer = data.answers.same_person;

      setResult({
        decision: mainAnswer.choice,
        confidence: mainAnswer.confidence,
        probabilities: mainAnswer.probabilities,
        factors: [
          { field: 'Nome', noul: data.answers.name_match.noul },
          { field: 'CPF', noul: data.answers.cpf_match.noul },
          { field: 'E-mail', noul: data.answers.email_match.noul },
          { field: 'Telefone', noul: data.answers.phone_match.noul },
          { field: 'Data Nasc.', noul: data.answers.dob_match.noul },
        ],
        latencyMs: latency,
        model: data.model,
        raw: data,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const verdictLabels: Record<string, string> = {
    MESMA_PESSOA: 'Mesma Pessoa',
    PESSOAS_DIFERENTES: 'Pessoas Diferentes',
    INCONCLUSIVO: 'Inconclusivo',
  };

  const verdictColor = (d: string) => {
    if (d === 'MESMA_PESSOA') return 'text-[#00D4AA]';
    if (d === 'PESSOAS_DIFERENTES') return 'text-[#FF6B35]';
    return 'text-[#8B95A8]';
  };

  const barColor = (d: string) => {
    if (d === 'MESMA_PESSOA') return 'bg-[#00D4AA]';
    if (d === 'PESSOAS_DIFERENTES') return 'bg-[#FF6B35]';
    return 'bg-[#8B95A8]';
  };

  const factorColor = (v: number) => {
    if (v >= 0.7) return 'text-[#00D4AA]';
    if (v <= 0.3) return 'text-[#FF6B35]';
    return 'text-[#8B95A8]';
  };

  const renderRecord = (rec: Record, label: string, sys: string) => (
    <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-5">
      <div className="flex justify-between items-center mb-3">
        <span className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest">{label}</span>
        <span className="font-[JetBrains_Mono,monospace] text-[0.7rem] text-[#00D4AA] bg-[rgba(0,212,170,0.08)] px-2 py-0.5 rounded">{sys}</span>
      </div>
      {Object.entries(rec).map(([key, val]) => (
        <div key={key} className="flex justify-between items-baseline py-1.5 border-b border-[rgba(139,149,168,0.06)] last:border-0">
          <span className="text-xs text-[#8B95A8]">{FIELD_LABELS[key]}</span>
          <span className="font-[JetBrains_Mono,monospace] text-xs text-[#E8ECF4] text-right">{val}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#E8ECF4] font-[Inter,sans-serif] flex flex-col items-center p-8">
      <h1 className="font-[Space_Grotesk,sans-serif] font-bold text-2xl tracking-tight mb-1">
        <span className="text-[#00D4AA]">JEV</span> Identity Matcher
      </h1>
      <p className="text-sm text-[#8B95A8] mb-6 max-w-[520px] text-center leading-relaxed">
        Classificação de identidade única entre sistemas usando a API real do JEV. Decisão tipada com probabilidade calibrada — sem alucinação, sem parsing de strings.
      </p>

      <div className="flex gap-2 items-center mb-8 w-full max-w-[600px]">
        <label className="font-[Space_Grotesk,sans-serif] text-xs font-semibold text-[#8B95A8] whitespace-nowrap">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Cole sua TypeSafe API key aqui (sk-...)"
          className="flex-1 font-[JetBrains_Mono,monospace] text-xs px-3 py-2 border border-[rgba(139,149,168,0.2)] rounded bg-[#141B2D] text-[#E8ECF4] outline-none focus:border-[#00D4AA]"
        />
      </div>

      <div className="flex gap-8 w-full max-w-[960px] items-start flex-wrap justify-center">
        {/* Records Column */}
        <div className="flex-1 min-w-[320px] flex flex-col gap-4">
          {renderRecord(scenario.a, 'Registro A', 'CRM Interno')}
          {renderRecord(scenario.b, 'Registro B', 'ERP Financeiro')}

          <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-5">
            <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-3">Cenários de Teste</div>
            <div className="flex gap-2 flex-wrap">
              {[
                ['exact', 'Match Exato'],
                ['fuzzy', 'Match Parcial'],
                ['different', 'Pessoas Diferentes'],
                ['typo', 'Erro de Digitação'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setScenarioKey(key); setResult(null); setError(''); }}
                  disabled={loading}
                  className={`font-[Space_Grotesk,sans-serif] text-xs font-semibold px-4 py-2 rounded border cursor-pointer transition-colors ${
                    scenarioKey === key
                      ? 'border-[#00D4AA] bg-[#00D4AA] text-[#0A0E17]'
                      : 'border-[rgba(139,149,168,0.2)] bg-[#141B2D] text-[#E8ECF4] hover:border-[#00D4AA]'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#8B95A8] mt-3 leading-relaxed">{scenario.desc}</p>
            <button
              onClick={callJev}
              disabled={loading}
              className="mt-4 w-full font-[Space_Grotesk,sans-serif] text-sm font-semibold px-5 py-2.5 rounded border border-[#00D4AA] bg-[#00D4AA] text-[#0A0E17] hover:bg-[#00bfa0] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Consultando JEV...' : 'Classificar com JEV'}
            </button>
            {error && <div className="text-[#FF6B35] text-xs mt-3 font-[JetBrains_Mono,monospace]">{error}</div>}
          </div>
        </div>

        {/* Result Column */}
        <div className="w-[340px] flex flex-col gap-4">
          <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-6 text-center">
            <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-2">Decisão JEV</div>
            <div className={`font-[Space_Grotesk,sans-serif] text-3xl font-bold leading-none mb-2 ${result ? verdictColor(result.decision) : 'text-[#8B95A8]'}`}>
              {result ? verdictLabels[result.decision] || result.decision : '—'}
            </div>
            {result && (
              <>
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 h-1.5 bg-[rgba(139,149,168,0.15)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${barColor(result.decision)}`} style={{ width: `${(result.confidence * 100).toFixed(1)}%` }} />
                  </div>
                  <span className="font-[JetBrains_Mono,monospace] text-xs text-[#8B95A8] min-w-[48px] text-right">{(result.confidence * 100).toFixed(1)}%</span>
                </div>
                <div className="font-[JetBrains_Mono,monospace] text-[0.65rem] text-[#8B95A8] mt-3">Latência: {result.latencyMs}ms · {result.model}</div>
              </>
            )}
          </div>

          <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-5">
            <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-3">Fatores de Decisão</div>
            {result ? (
              result.factors.map((f) => (
                <div key={f.field} className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-[#8B95A8]">{f.field}</span>
                  <span className={`font-[JetBrains_Mono,monospace] text-xs ${factorColor(f.noul)}`}>{(f.noul * 100).toFixed(1)}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-[#8B95A8]">Aguardando classificação...</div>
            )}
          </div>

          <div className="bg-[#141B2D] border border-[rgba(139,149,168,0.12)] rounded p-5">
            <div className="font-[Space_Grotesk,sans-serif] text-[0.7rem] font-semibold text-[#8B95A8] uppercase tracking-widest mb-3">Saída Estruturada (JSON)</div>
            <pre className="font-[JetBrains_Mono,monospace] text-[0.65rem] text-[#8B95A8] whitespace-pre-wrap leading-relaxed m-0">
              {result ? JSON.stringify(result.raw, null, 2) : '{ "decision": null }'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}