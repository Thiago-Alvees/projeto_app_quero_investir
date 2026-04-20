export type B3Course = {
  id: string;
  title: string;
  summary: string;
  level: "Iniciante" | "Intermediário";
  category: "Primeiros Passos" | "Renda Fixa" | "Renda Variável" | "Planejamento";
  url: string;
  trackStep: number;
  trackStage: "Base" | "Ativos" | "Análise" | "Gestão";
};

export const B3_INVESTMENT_COURSES: B3Course[] = [
  {
    id: "b3-como-comecar-investir",
    title: "Como começar a investir",
    summary:
      "Introdução ao universo de investimentos para montar base antes de escolher ativos.",
    level: "Iniciante",
    category: "Primeiros Passos",
    url: "https://edu.b3.com.br/w/como-comecar-a-investir",
    trackStep: 1,
    trackStage: "Base",
  },
  {
    id: "b3-produtos-investimento",
    title: "Trilha - Produtos de Investimento B3",
    summary:
      "Visão geral dos principais produtos para entender como cada classe funciona.",
    level: "Iniciante",
    category: "Primeiros Passos",
    url: "https://edu.b3.com.br/w/trilha-produtos-de-investimento-b3",
    trackStep: 2,
    trackStage: "Base",
  },
  {
    id: "b3-diversificacao",
    title: "Como diversificar seus investimentos",
    summary:
      "Mostra como distribuir risco e evitar concentração em um único tipo de ativo.",
    level: "Iniciante",
    category: "Planejamento",
    url: "https://edu.b3.com.br/w/como-diversificar-seus-investimentos",
    trackStep: 3,
    trackStage: "Base",
  },
  {
    id: "b3-renda-fixa",
    title: "Como investir em renda fixa",
    summary:
      "Explica títulos de renda fixa, risco, liquidez e retorno para decisões mais seguras.",
    level: "Iniciante",
    category: "Renda Fixa",
    url: "https://edu.b3.com.br/w/como-investir-em-renda-fixa",
    trackStep: 4,
    trackStage: "Ativos",
  },
  {
    id: "b3-tesouro-direto",
    title: "Trilha - O que é e como investir no Tesouro Direto",
    summary:
      "Aprofunda títulos públicos e como usá-los no planejamento de curto e longo prazo.",
    level: "Iniciante",
    category: "Renda Fixa",
    url: "https://edu.b3.com.br/w/trilha-o-que-e-e-como-investir-no-tesouro-direto",
    trackStep: 5,
    trackStage: "Ativos",
  },
  {
    id: "b3-beaba-fiis",
    title: "Aprenda o Beabá dos Fundos Imobiliários",
    summary:
      "Fundamentos de FIIs, leitura básica dos indicadores e como avaliar renda mensal.",
    level: "Iniciante",
    category: "Renda Variável",
    url: "https://edu.b3.com.br/w/aprenda-o-beaba-dos-fundos-imobiliarios",
    trackStep: 6,
    trackStage: "Ativos",
  },
  {
    id: "b3-iniciante-acoes",
    title: "Iniciante no Mercado de Ações",
    summary:
      "Introdução à bolsa para quem está começando e quer reduzir erros comuns.",
    level: "Iniciante",
    category: "Renda Variável",
    url: "https://edu.b3.com.br/w/iniciante-no-mercado-de-acoes",
    trackStep: 7,
    trackStage: "Ativos",
  },
  {
    id: "b3-acoes",
    title: "Aprenda a investir em ações",
    summary:
      "Estrutura de análise para ações com foco em leitura de cenário e fundamentos.",
    level: "Intermediário",
    category: "Renda Variável",
    url: "https://edu.b3.com.br/w/aprenda-a-investir-em-acoes",
    trackStep: 8,
    trackStage: "Ativos",
  },
  {
    id: "b3-etf",
    title: "ETF - Entenda o que é e como funciona",
    summary:
      "Mostra como ETFs ajudam na diversificação e comparação de custo x simplicidade.",
    level: "Iniciante",
    category: "Renda Variável",
    url: "https://edu.b3.com.br/w/etf-entenda-o-que-e-e-como-funciona",
    trackStep: 9,
    trackStage: "Ativos",
  },
  {
    id: "b3-analises-investimentos",
    title: "Como fazer Análises de Investimentos",
    summary:
      "Métodos para analisar oportunidades sem depender de recomendação pronta.",
    level: "Intermediário",
    category: "Planejamento",
    url: "https://edu.b3.com.br/w/como-fazer-analises-de-investimentos",
    trackStep: 10,
    trackStage: "Análise",
  },
  {
    id: "b3-analise-fundamentalista",
    title: "Análise Fundamentalista de Ações",
    summary:
      "Aprofunda indicadores de avaliação para comparar empresas com maior critério.",
    level: "Intermediário",
    category: "Renda Variável",
    url: "https://edu.b3.com.br/w/analise-fundamentalista-de-acoes",
    trackStep: 11,
    trackStage: "Análise",
  },
  {
    id: "b3-comportamento",
    title: "Comportamento do Investidor",
    summary:
      "Ajuda a evitar vieses emocionais que prejudicam consistência e disciplina.",
    level: "Iniciante",
    category: "Planejamento",
    url: "https://edu.b3.com.br/en/w/comportamento-do-investidor",
    trackStep: 12,
    trackStage: "Gestão",
  },
  {
    id: "b3-tributacao",
    title: "Tributação de investimentos para iniciantes",
    summary:
      "Noções fiscais para não errar no cálculo de impostos dos investimentos.",
    level: "Iniciante",
    category: "Planejamento",
    url: "https://edu.b3.com.br/w/tributacao-de-investimentos-para-iniciantes",
    trackStep: 13,
    trackStage: "Gestão",
  },
  {
    id: "b3-declarando-investimentos",
    title: "Declarando seus investimentos",
    summary:
      "Guia de declaração para organizar a vida fiscal e manter conformidade anual.",
    level: "Iniciante",
    category: "Planejamento",
    url: "https://edu.b3.com.br/en/w/declarando-seus-investimentos",
    trackStep: 14,
    trackStage: "Gestão",
  },
];
