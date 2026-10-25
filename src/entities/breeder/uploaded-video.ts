export function isUploadedBreederVideo(url: string) {
  return /^https:\/\/res\.cloudinary\.com\/[\w-]+\/video\/upload\/v[1-9]\d*\/pet-platform\/breeders\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(mp4|webm)$/.test(
    url,
  );
}
