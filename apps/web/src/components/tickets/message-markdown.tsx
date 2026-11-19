import Markdown from 'react-markdown';

// Keep the library's default URL transform. No raw HTML, remote images, MDX or plugins.
export function MessageMarkdown({ children }: { children: string }) {
  return <div className="min-w-0 space-y-3 text-sm leading-7 wrap-anywhere [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_h4]:text-base [&_h4]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:list-disc [&_ul]:ps-6 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs">
    <Markdown skipHtml disallowedElements={['img']} components={{
      h1: ({ children }) => <h4>{children}</h4>,
      h2: ({ children }) => <h4>{children}</h4>,
      h3: ({ children }) => <h4>{children}</h4>,
      a: ({ href, children }) => href ? <a href={href} className="cursor-pointer text-primary underline underline-offset-4" rel="noreferrer">{children}</a> : <span>{children}</span>
    }}>{children}</Markdown>
  </div>;
}
