module.exports = (error, req, res, next) => {
  const status = error.status || ({ '23505': 409, '23503': 409, '23502': 400, '23514': 400, '22P02': 400, '22007': 400, '22008': 400, '22001': 400, LIMIT_FILE_SIZE: 413, LIMIT_UNEXPECTED_FILE: 400, LIMIT_FIELD_COUNT: 400 }[error.code]) || 500;
  if (status === 500) console.error(error);
  res.status(status).json({ erro: true, mensagem: status === 500 ? 'Não foi possível concluir a operação.' : status === 409 ? 'Registro duplicado ou em uso.' : error.code ? 'Verifique os campos e o tamanho do arquivo (máximo 5 MB).' : error.message });
};
