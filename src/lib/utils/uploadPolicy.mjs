export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const FORMAT_POLICY = Object.freeze({
  jpg: { resourceType: 'image', mimeTypes: ['image/jpeg'], formats: ['jpg', 'jpeg'] },
  jpeg: { resourceType: 'image', mimeTypes: ['image/jpeg'], formats: ['jpg', 'jpeg'] },
  png: { resourceType: 'image', mimeTypes: ['image/png'] },
  gif: { resourceType: 'image', mimeTypes: ['image/gif'] },
  webp: { resourceType: 'image', mimeTypes: ['image/webp'] },
  heic: { resourceType: 'image', mimeTypes: ['image/heic', 'image/heif'] },
  heif: { resourceType: 'image', mimeTypes: ['image/heif', 'image/heic'] },
  tif: { resourceType: 'image', mimeTypes: ['image/tiff'], formats: ['tif', 'tiff'] },
  tiff: { resourceType: 'image', mimeTypes: ['image/tiff'], formats: ['tif', 'tiff'] },
  bmp: { resourceType: 'image', mimeTypes: ['image/bmp', 'image/x-ms-bmp'] },
  mp4: { resourceType: 'video', mimeTypes: ['video/mp4'] },
  mov: { resourceType: 'video', mimeTypes: ['video/quicktime'] },
  avi: { resourceType: 'video', mimeTypes: ['video/x-msvideo', 'video/avi'] },
  mkv: { resourceType: 'video', mimeTypes: ['video/x-matroska'] },
  webm: { resourceType: 'video', mimeTypes: ['video/webm', 'audio/webm'] },
  mp3: { resourceType: 'video', mimeTypes: ['audio/mpeg', 'audio/mp3'] },
  m4a: { resourceType: 'video', mimeTypes: ['audio/mp4', 'audio/x-m4a'] },
  wav: { resourceType: 'video', mimeTypes: ['audio/wav', 'audio/x-wav'] },
  ogg: { resourceType: 'video', mimeTypes: ['audio/ogg', 'video/ogg', 'application/ogg'] },
  oga: { resourceType: 'video', mimeTypes: ['audio/ogg', 'application/ogg'] },
  aac: { resourceType: 'video', mimeTypes: ['audio/aac', 'audio/x-aac'] },
  flac: { resourceType: 'video', mimeTypes: ['audio/flac', 'audio/x-flac'] },
  pdf: { resourceType: 'raw', mimeTypes: ['application/pdf'] },
  doc: { resourceType: 'raw', mimeTypes: ['application/msword'] },
  docx: { resourceType: 'raw', mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  xls: { resourceType: 'raw', mimeTypes: ['application/vnd.ms-excel'] },
  xlsx: { resourceType: 'raw', mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  ppt: { resourceType: 'raw', mimeTypes: ['application/vnd.ms-powerpoint'] },
  pptx: { resourceType: 'raw', mimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'] },
  txt: { resourceType: 'raw', mimeTypes: ['text/plain'] },
  md: { resourceType: 'raw', mimeTypes: ['text/markdown', 'text/plain'] },
  csv: { resourceType: 'raw', mimeTypes: ['text/csv', 'application/csv'] },
  json: { resourceType: 'raw', mimeTypes: ['application/json', 'text/json'] },
  rtf: { resourceType: 'raw', mimeTypes: ['application/rtf', 'text/rtf'] },
  zip: { resourceType: 'raw', mimeTypes: ['application/zip', 'application/x-zip-compressed'] },
  '7z': { resourceType: 'raw', mimeTypes: ['application/x-7z-compressed'] },
});

const entriesFor = resourceType => Object.entries(FORMAT_POLICY)
  .filter(([, policy]) => policy.resourceType === resourceType);

const acceptFor = entries => [
  ...entries.map(([extension]) => `.${extension}`),
  ...new Set(entries.flatMap(([, policy]) => policy.mimeTypes)),
].join(',');

const IMAGE_ENTRIES = entriesFor('image');
const AUDIO_ENTRIES = Object.entries(FORMAT_POLICY).filter(([extension]) =>
  ['webm', 'mp3', 'm4a', 'wav', 'ogg', 'oga', 'aac', 'flac'].includes(extension));

export const IMAGE_UPLOAD_ACCEPT = acceptFor(IMAGE_ENTRIES);
export const AUDIO_UPLOAD_ACCEPT = acceptFor(AUDIO_ENTRIES);
export const ATTACHMENT_UPLOAD_ACCEPT = acceptFor(Object.entries(FORMAT_POLICY));

function normalizedMimeType(value) {
  return typeof value === 'string' ? value.split(';', 1)[0].trim().toLowerCase() : '';
}

export function uploadFilePolicy(file, { maxBytes = MAX_UPLOAD_BYTES } = {}) {
  const name = typeof file?.name === 'string' ? file.name.trim() : '';
  const size = Number(file?.size);
  const mimeType = normalizedMimeType(file?.type);
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const policy = FORMAT_POLICY[extension];

  if (!name || name.length > 240 || !policy) {
    return { error: 'Цей тип файлу не підтримується' };
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes) {
    return { error: `Файл завеликий — ліміт ${Math.floor(maxBytes / 1024 / 1024)} МБ` };
  }
  if (!policy.mimeTypes.includes(mimeType)) {
    return { error: 'Тип файла не відповідає його розширенню' };
  }

  return {
    value: {
      extension,
      mimeType,
      size,
      resourceType: policy.resourceType,
      allowedFormats: policy.formats || [extension],
    },
  };
}

export function requireUploadFilePolicy(file, options) {
  const result = uploadFilePolicy(file, options);
  if (result.error) throw new Error(result.error);
  return result.value;
}
