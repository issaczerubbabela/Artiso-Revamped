// Marks Apple platforms (iPad, iPhone, Mac) on <html data-platform="apple"> so
// tokens.css can switch to San Francisco / SF Mono (docs/design.md §3).
//
// It runs as an inline script in <head>, before first paint, so text never
// flashes from one typeface to the other -- which is why it is a self-contained
// string rather than an imported module. iPadOS Safari reports itself as a Mac
// ("MacIntel", "Macintosh"), so a Mac check covers the iPad too; every browser
// on iPad is WebKit with the same user agent shape.
export const APPLE_PLATFORM_SCRIPT = `(function(){try{
var n=navigator,p=(n.userAgentData&&n.userAgentData.platform)||n.platform||'',u=n.userAgent||'';
if(/Mac|iPhone|iPad|iPod/i.test(p)||/Macintosh|iPhone|iPad|iPod/.test(u))document.documentElement.setAttribute('data-platform','apple');
}catch(e){}})();`;
