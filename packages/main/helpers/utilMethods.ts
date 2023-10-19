const dayjs = require('dayjs');

export function formatDate(date: Date) {
  const formattedDate = dayjs(date).format('YYYY-MM-DDTHH:mm:ss.SSSZ');

  return formattedDate;
}

// Used to serialize a field of vector data type so that it can be stored in a table as a blob
export function serializeVector(vector: number[]) {
  return Buffer.from(JSON.stringify(vector));
}

export function deserializeVector(vectorBlob: string) {
  return JSON.parse(vectorBlob.toString());
}

export function calculateDotProduct(vector1: number[], vector2: number[]) {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same length for dot product calculation.');
  }

  let dotProduct = 0;
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
  }

  return dotProduct;
}
