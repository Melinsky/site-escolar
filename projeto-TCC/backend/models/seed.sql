-- Initial content copied from the supplied project; confirm dates and school indicators before publishing.
DO $seed$ BEGIN IF NOT EXISTS (SELECT 1 FROM cursos) THEN
INSERT INTO cursos (nome, descricao, duracao, turno, certificacao, vagas, categoria) VALUES
('Administracao', 'Formacao completa em gestao empresarial, financas, recursos humanos e marketing.', '2 Anos', 'Manha', 'MEC Reconhecido', 30, 'Gestao e Negocios'),
('Vendas', 'Tecnicas de negociacao, atendimento ao cliente, gestao de vendas e comercio eletronico.', '2 Anos', 'Manha', 'MEC Reconhecido', 30, 'Gestao e Negocios'),
('Desenvolvimento de Sistemas', 'Programacao, banco de dados, desenvolvimento web e dispositivos moveis, engenharia de software.', '2 Anos', 'Manha', 'MEC Reconhecido', 30, 'Informacao e Comunicacao');
END IF; END $seed$;

DO $seed$ BEGIN IF NOT EXISTS (SELECT 1 FROM eventos) THEN
INSERT INTO eventos (titulo, descricao, data_evento, hora_inicio, local_evento, tipo, destaque) VALUES
('Reuniao de Pais e Mestres', 'Encontro para discutir o desenvolvimento academico dos alunos.', '2026-03-15', '19h', 'Auditorio da Escola', 'evento', FALSE),
('Dia das Maes', 'Apresentacoes culturais e homenagens preparadas pelos alunos.', '2026-05-10', '15h', 'Auditorio da Escola', 'evento', FALSE),
('Festa Junina', 'Tradicional festa junina com comidas tipicas e quadrilha.', '2026-06-05', '14h as 20h', 'Quadra da Escola', 'evento', FALSE),
('Olimpiadas de Matematica', 'Competicao interna de matematica entre os alunos.', '2026-06-20', '8h as 12h', 'Salas de aula', 'evento', FALSE),
('Encerramento do Semestre', 'Cerimonia de encerramento do primeiro semestre.', '2026-07-15', '19h', 'Auditorio da Escola', 'evento', FALSE),
('Feira de Ciencias 2026', 'Exposicao de projetos cientificos dos alunos.', '2026-04-22', '10h as 17h', 'Patio da Escola', 'evento', TRUE);
END IF; END $seed$;

DO $seed$ BEGIN IF NOT EXISTS (SELECT 1 FROM avisos) THEN
INSERT INTO avisos (titulo, descricao, tipo, urgente, data_publicacao) VALUES
('Recolhimento de Material Escolar', 'Prazo para entrega do material estendido ate 30 de abril.', 'urgente', TRUE, '2026-03-15'),
('Mudanca de Horario das Aulas', 'Primeiro periodo iniciara as 7h30 e ultimo encerrara as 16h40.', 'importante', FALSE, '2026-03-12'),
('Inscricoes para o Estagio', 'Abertas inscricoes para programa de estagiarios da escola.', 'informativo', FALSE, '2026-03-10'),
('Regra de Uniforme', 'Uso do uniforme escolar e obrigatorio em todos os dias letivos.', 'alerta', FALSE, '2026-03-08'),
('Biblioteca - Novo Horario', 'Biblioteca funcionara das 7h30 as 17h.', 'informativo', FALSE, '2026-03-05'),
('Reuniao de Pais - 2o Bimestre', 'Reuniao realizada no dia 15 de marco, as 19h.', 'importante', FALSE, '2026-03-01');
END IF; END $seed$;

DO $seed$ BEGIN IF NOT EXISTS (SELECT 1 FROM comunicados) THEN
INSERT INTO comunicados (titulo, descricao, tag, data_publicacao) VALUES
('Resultados do Enem 2025', '85% dos egressos atingiram nota acima de 600 pontos na redacao.', 'resultado', '2026-03-20'),
('Professora do Ano', 'Ana Paula Rocha eleita Professora do Ano pela comunidade escolar.', 'homenagem', '2026-03-18'),
('Novo Laboratorio de Informatica', 'Inauguracao com 30 computadores novos para turmas de DS.', 'novidade', '2026-03-15'),
('Olimpiadas de Matematica - Resultado', 'Vencedores premiados em cerimonia no auditorio.', 'resultado', '2026-03-12'),
('Dia Internacional da Mulher', 'Homenagem especial no patio da escola.', 'homenagem', '2026-03-08'),
('Novo Projeto de Mentoria', 'Conexao entre ex-alunos profissionais e alunos atuais.', 'novidade', '2026-03-01');
END IF; END $seed$;

DO $seed$ BEGIN IF NOT EXISTS (SELECT 1 FROM galeria) THEN
INSERT INTO galeria (titulo, descricao, caminho_imagem, ordem) VALUES
('Fachada da escola', 'Fachada principal da EEAFR', 'imagens/Escola/Fachada2.jpeg', 1),
('Patio da escola', 'Patio da escola', 'imagens/Escola/Patio.jpeg', 2),
('Corredor principal', 'Corredor principal da escola', 'imagens/Escola/Corredor.jpeg', 3),
('Entrada da secretaria', 'Entrada da secretaria', 'imagens/Escola/Entrada Secretaria.jpeg', 4),
('Refeitorio', 'Refeitorio da escola', 'imagens/Escola/Refeitorio.jpeg', 5),
('Cozinha escolar', 'Cozinha escolar', 'imagens/Escola/Cozinha.jpeg', 6),
('Cantina', 'Cantina da escola', 'imagens/Escola/Cantina do tio.jpeg', 7),
('Quadra de esportes', 'Quadra de esportes', 'imagens/Escola/Quadra.jpeg', 8),
('Secretaria', 'Secretaria da escola', 'imagens/Escola/Secretaria 1.jpeg', 9),
('Corredor perto da escada', 'Corredor perto da escada', 'imagens/Escola/Corredor perto da escada.jpeg', 10),
('Corredor das salas de aula', 'Corredor das salas de aula', 'imagens/Escola/Corredor sala 1.jpeg', 11),
('Patio da escola', 'Patio da escola', 'imagens/Escola/Patio2.jpeg', 12);
END IF; END $seed$;

DO $seed$ BEGIN IF NOT EXISTS (SELECT 1 FROM professores) THEN
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Maria Aparecida Cruz de Araujo','Linguagem','Língua Inglesa e Redação','MA');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Sandra Regina Toso de Campos','Linguagem','Língua Portuguesa','SC');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Thais Santos Meira Ferreira','Linguagem','Língua Portuguesa, Redação e Leitura','TF');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Debora da Silva Dalonso','Exatas','Física, Matemática, Ed. Financeira e Orientação de Estudo','DD');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Diemes de Oliveira','Exatas','Biologia','DO');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Rosangela Brasil de Souza Gallo','Exatas','Matemática e Educação Financeira','RG');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Marcos Ferreira de Souza','Humanas','Geografia','MS');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Nodil Andrade Pereira','Humanas','Geografia','ND');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Rodrigo Gago Machado de Oliveira','Humanas','Educação Física','RO');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Valeria Fernandes da Mota','Humanas','História e Sociologia','VM');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Anderson Bastos do Carmo','Tecnicos','Ánalise e Desenvolvimento de Sistemas, Técnico Eletrônico e Engenharia de Controle em Automação Industrial','AB');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('André Luis Mendes','Tecnicos','Desenvolvimento de Sistemas e Inteligencia Artificial','AL');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Gabriel Moreira Monteiro da Silva','Tecnicos','Programação (Backend, Frontend, Mobile), Banco de Dados, Metodologias Ágeis e Redes','GS');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Rafael Assis de Araujo','Tecnicos','Desenvolvimento de Sistemas, Coordenador de Curso e Projeto Multidisciplinar.','RA');
INSERT INTO professores(nome,area,disciplina,sigla) VALUES ('Kelliane de Jesus Nascimento','Tecnicos','Vendas, Matemática Aplicada, Gestão Financeira e Projeto DS','KN');
END IF; END $seed$;

DO $seed$ BEGIN IF NOT EXISTS (SELECT 1 FROM escola_dados) THEN
INSERT INTO escola_dados(campo,valor) VALUES ('nome','Escola Estadual Antônio Francisco Redondo');
INSERT INTO escola_dados(campo,valor) VALUES ('sigla','EEAFR');
INSERT INTO escola_dados(campo,valor) VALUES ('inep','35000218');
INSERT INTO escola_dados(campo,valor) VALUES ('cie','218');
INSERT INTO escola_dados(campo,valor) VALUES ('diretoria_ensino','Norte 1');
INSERT INTO escola_dados(campo,valor) VALUES ('endereco','R. Evandro Danton Ferreira Gandra, 148');
INSERT INTO escola_dados(campo,valor) VALUES ('bairro','Vila Mangalot');
INSERT INTO escola_dados(campo,valor) VALUES ('cidade','São Paulo');
INSERT INTO escola_dados(campo,valor) VALUES ('uf','SP');
INSERT INTO escola_dados(campo,valor) VALUES ('cep','05131-100');
INSERT INTO escola_dados(campo,valor) VALUES ('telefone','(11) 3904-5011');
INSERT INTO escola_dados(campo,valor) VALUES ('email','e000218a@educacao.sp.gov.br');
INSERT INTO escola_dados(campo,valor) VALUES ('ideb','4.0');
INSERT INTO escola_dados(campo,valor) VALUES ('idesp','1.98');
INSERT INTO escola_dados(campo,valor) VALUES ('alunos_matriculados','704');
INSERT INTO escola_dados(campo,valor) VALUES ('turmas','18');
INSERT INTO escola_dados(campo,valor) VALUES ('professores_qtd','30');
INSERT INTO escola_dados(campo,valor) VALUES ('horario','Segunda a sexta, das 7h às 17h');
INSERT INTO escola_dados(campo,valor) VALUES ('instagram','afredondo');
INSERT INTO escola_dados(campo,valor) VALUES ('diretora','Carla Rodrigues Ribeiro');
INSERT INTO escola_dados(campo,valor) VALUES ('vice_diretor_1','Pedro Henrique Soares da Silva Farias');
INSERT INTO escola_dados(campo,valor) VALUES ('vice_diretor_2','Sandra Maria Felipe');
INSERT INTO escola_dados(campo,valor) VALUES ('coordenadora_1','Juliana Mendes Avona');
INSERT INTO escola_dados(campo,valor) VALUES ('coordenadora_2','Maria Solange Petras');
END IF; END $seed$;

UPDATE cursos SET sobre='Sobre o Curso
                  O curso técnico em Administração da EEAFR forma profissionais capacitados para atuar em gestão empresarial, finanças, recursos humanos, marketing e logística. Com uma abordagem prática e teórica, os alunos desenvolvem competências para planejar, organizar e controlar processos administrativos em empresas de diversos portes.
                  Ao longo do curso, os estudantes participam de projetos reais, estágios em empresas e atividades que simulam o ambiente corporativo, preparando-se para ingressar no mercado de trabalho com segurança e competência.',modulos='Matemática e Estatística
Teoria Geral da Administração (TGA)
Economia
Contabilidade
Direito Empresarial
Marketing',habilidades='Gerenciamento de projetos
Análise e tomada de decisão
Comunicação e liderança
Manejo de ferramentas administrativas
Trabalho em equipe multidisciplinar
Resolução de problemas',carreira='Assistente Administrativo
Analista de RH
Assistente Financeiro
Empreendedor' WHERE id=1 AND COALESCE(sobre,'')='';
UPDATE cursos SET sobre='Sobre o Curso
                  O curso técnico em Vendas da EEAFR desenvolve habilidades essenciais para o mercado comercial. Os alunos aprendem técnicas de negociação, atendimento ao cliente, gestão de equipes de vendas, e-commerce e estratégias de marketing digital.
                  Com foco na prática, o curso prepara profissionais para atuar no varejo, atacado, plataformas online e área comercial de empresas de qualquer porte. Os alunos participam de simulações de vendas, feiras comerciais e estágios em empresas do mercado.',modulos='Técnicas de Vendas
Negociação
E-commerce
Marketing Digital
Gestão de Equipes
Atendimento ao Cliente',habilidades='Comunicação persuasiva
Liderança e motivação
Manejo de objeções
Planejamento comercial
Uso de CRM e ferramentas digitais
Experiência do cliente',carreira='Consultor de Vendas
Gerente Comercial
Especialista E-commerce
Representante Comercial' WHERE id=2 AND COALESCE(sobre,'')='';
UPDATE cursos SET sobre='Sobre o Curso
                  O curso técnico em Desenvolvimento de Sistemas da EEAFR capacita o aluno para projetar, desenvolver e manter sistemas computacionais. O conteúdo aborda programação web e mobile, banco de dados, engenharia de software, redes e segurança da informação.
                  Com metodologias ágeis e projetos práticos, os alunos aprendem a trabalhar com as tecnologias mais utilizadas pelo mercado: JavaScript, Python, React, banco de dados SQL e NoSQL, e muito mais. O curso prepara para atuar como desenvolvedor full stack.',modulos='Lógica de Programação
Programação Web
Banco de Dados
Engenharia de Software
Redes e Segurança
Programação Mobile',habilidades='Programação em múltiplas linguagens
Resolução de problemas lógicos
Trabalho em equipe com metodologias ágeis
Criação de APIs e integrações
Controle de versão com Git
Desenvolvimento de aplicativos completos',carreira='Desenvolvedor Full Stack
Desenvolvedor Front-End
Desenvolvedor Back-End
Analista de TI' WHERE id=3 AND COALESCE(sobre,'')='';
