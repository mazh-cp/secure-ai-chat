export default function ThemeScript() {
  const code = `
(function() {
  try {
    var t = localStorage.getItem("theme");
    if (t !== "day" && t !== "dark") t = "dark";
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.style.colorScheme = (t === "dark") ? "dark" : "light";
  } catch (e) {}
})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
