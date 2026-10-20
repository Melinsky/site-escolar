// Shared field definitions drive both API validation and dashboard forms.
const text = (label, max = 200, required = false, type = 'text') => ({ label, max, required, type });
const long = label => text(label, 20000, false, 'textarea');
const choice = (label, options, required = true) => ({ label, type: 'select', options, required });
const date = label => ({ label, type: 'date' });
const bool = label => ({ label, type: 'checkbox' });
const number = label => ({ label, type: 'number', min: 0, max: 100000 });
const title = { titulo: text('Título', 200, true), descricao: long('Descrição') };
module.exports = {
 cursos: { label: 'Cursos', table: 'cursos', order: 'id', fields: {
  nome: text('Nome do curso', 100, true), descricao: long('Apresentação'), categoria: text('Categoria', 100), duracao: text('Duração', 50),
  turno: text('Turno', 50), certificacao: text('Certificação', 100), vagas: number('Vagas por turma'),
  sobre: long('Sobre o curso'), modulos: long('Matriz curricular (um item por linha)'), habilidades: long('Habilidades (uma por linha)'), carreira: long('Carreiras (uma por linha)') } },
 eventos: { label: 'Eventos e calendário', table: 'eventos', order: 'data_evento DESC NULLS LAST, id DESC', fields: {
  ...title, data_evento: date('Data do evento'), hora_inicio: text('Horário', 20), local_evento: text('Local'),
  tipo: choice('Tipo', ['evento', 'calendario']), destaque: bool('Destacar evento') } },
 avisos: { label: 'Avisos', table: 'avisos', order: 'data_publicacao DESC, id DESC', fields: {
  ...title, tipo: choice('Categoria', ['informativo','importante','alerta','urgente']), urgente: bool('Aviso urgente'), data_publicacao: date('Data de publicação') } },
 comunicados: { label: 'Comunicados', table: 'comunicados', order: 'data_publicacao DESC, id DESC', fields: {
  ...title, tag: choice('Categoria', ['novidade','resultado','homenagem']), data_publicacao: date('Data de publicação') } },
 galeria: { label: 'Galeria', table: 'galeria', order: 'ordem, id', fields: {
  ...title, caminho_imagem: { ...text('Imagem', 500, true), type: 'image' }, ordem: number('Ordem de exibição') } },
 professores: { label: 'Corpo docente', table: 'professores', order: 'id', fields: {
  nome: text('Nome', 200, true), area: choice('Área', ['Linguagem','Exatas','Humanas','Tecnicos']), disciplina: long('Disciplinas'), sigla: text('Iniciais', 10) } },
 escola: { label: 'Dados da escola', table: 'escola_dados', order: 'id', key: 'campo', fields: {
  campo: text('Identificador (ex.: telefone)', 100, true), valor: text('Valor', 20000, true, 'textarea') } },
};
