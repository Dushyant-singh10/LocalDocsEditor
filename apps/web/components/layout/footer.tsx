// Submission requirement: name + GitHub + LinkedIn must appear in the app
// footer. Fill in the three constants below with your real details before
// submitting/deploying.
const AUTHOR_NAME = "YOUR NAME";
const GITHUB_URL = "https://github.com/YOUR_USERNAME";
const LINKEDIN_URL = "https://linkedin.com/in/YOUR_USERNAME";

export function Footer() {
  return (
    <footer className="border-t px-4 py-3 text-sm text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <span>{AUTHOR_NAME}</span>
      <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-foreground underline underline-offset-4">
        GitHub
      </a>
      <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="hover:text-foreground underline underline-offset-4">
        LinkedIn
      </a>
    </footer>
  );
}
