import { JUNIT_XML_MAX_BYTES, say, type JUnitImport } from "@openspec-ui/core";

/** Native host input collection only. Parsing and persistence belong to Core. */
export async function pickJUnitReport<File>(head: string, host: {
  choose: () => Promise<File | undefined>;
  size: (file: File) => Promise<number>;
  commit: () => Promise<string | undefined>;
  read: (file: File) => Promise<Uint8Array>;
}): Promise<JUnitImport | undefined> {
  const file = await host.choose();
  if (file === undefined) return undefined;
  if (await host.size(file) > JUNIT_XML_MAX_BYTES) throw new Error(say("OSW-CHG-014").text);
  const testedCommit = await host.commit();
  if (testedCommit === undefined) return undefined;
  const bytes = await host.read(file);
  if (bytes.byteLength > JUNIT_XML_MAX_BYTES) throw new Error(say("OSW-CHG-014").text);
  return { head, testedCommit: testedCommit.trim(), xml: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
}
