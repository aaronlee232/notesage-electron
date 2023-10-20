const dayjs = require('dayjs');

/**
 * Formats a date to the 'YYYY-MM-DDTHH:mm:ss.SSSZ' format.
 *
 * @param {Date} date - The date to be formatted.
 * @returns {string} The formatted date.
 * @export
 */
export function formatDate(date: Date) {
  const formattedDate = dayjs(date).format('YYYY-MM-DDTHH:mm:ss.SSSZ');

  return formattedDate;
}

/**
 * Serializes a vector into a Buffer object.
 *
 * @param {number[]} vector - The vector to be serialized.
 * @returns {Buffer} The serialized vector as a Buffer object.
 * @export
 */
export function serializeVector(vector: number[]) {
  return Buffer.from(JSON.stringify(vector));
}

/**
 * Deserializes a vector from a Buffer object.
 *
 * @param {Buffer} vectorBlob - The Buffer object containing the serialized vector.
 * @returns {Object} The deserialized vector.
 */
export function deserializeVector(vectorBlob: Buffer) {
  return JSON.parse(vectorBlob.toString());
}

/**
 * Calculates the dot product of two vectors.
 *
 * @param {number[]} vector1 - The first vector.
 * @param {number[]} vector2 - The second vector.
 * @returns {number} The dot product of the two vectors.
 * @throws {Error} If the vectors do not have the same length.
 */
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
