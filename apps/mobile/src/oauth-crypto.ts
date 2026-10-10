type IntegerArray = Uint8Array | Uint8ClampedArray | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array;

export function installOAuthCrypto(
  target: { crypto?: Crypto },
  native: {
    getRandomValues<ArrayType extends IntegerArray>(array: ArrayType): ArrayType;
    randomUUID(): string;
    digestSha256(data: BufferSource): Promise<ArrayBuffer>;
  },
) {
  if (!target.crypto) Object.defineProperty(target, "crypto", { value: {}, configurable: true });
  const crypto = target.crypto!;
  if (!crypto.getRandomValues) Object.defineProperty(crypto, "getRandomValues", { value: native.getRandomValues });
  if (!crypto.randomUUID) Object.defineProperty(crypto, "randomUUID", { value: native.randomUUID });
  if (!crypto.subtle) {
    Object.defineProperty(crypto, "subtle", { value: {
      async digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
        const name = typeof algorithm === "string" ? algorithm : algorithm.name;
        if (name.toUpperCase() !== "SHA-256") throw new Error("Only SHA-256 is supported by the OAuth crypto adapter.");
        return native.digestSha256(data);
      },
    } });
  }
}
