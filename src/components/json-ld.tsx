/**
 * JSON-LD script bileşeni (Faz 9 T4). `<` kaçırılır ki içerikten gelen
 * `</script>` enjeksiyonu script'i kapatamasın.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
