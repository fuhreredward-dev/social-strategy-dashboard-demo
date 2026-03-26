const state = {
  period: "this_month",
  topContent: [],
  detailChart: null,
  sparkCharts: [],
  platformBarChart: null,
  propertyMixChart: null,
  funnelMixChart: null,
  platformsPageBarChart: null,
  platformsPageEngChart: null,
  propertiesPageBarChart: null,
  propertiesPageLiftChart: null,
};

const isGitHubPages = window.location.hostname.includes("github.io");

function fetchMock(name) {
  return fetch(`./mock/${name}.json`).then((res) => {
    if (!res.ok) throw new Error(`Mock API error: ${res.status}`);
    return res.json();
  });
}

const fmt = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${Math.round(n)}`;
};

function kv(label, value) {
  return `<div class="kv"><span>${label}</span><strong>${value}</strong></div>`;
}

async function api(path) {
  if (isGitHubPages) {
    if (path.startsWith("/dashboard_summary")) return fetchMock("dashboard_summary");
    if (path.startsWith("/top_content")) return fetchMock("top_content");
    if (path.startsWith("/platform_summary")) return fetchMock("platform_summary");
    if (path.startsWith("/property_summary")) return fetchMock("property_summary");
    if (path.startsWith("/content/")) {
      const postId = path.split("/content/")[1];
      const safeId = (postId || "demo-001").split("?")[0];
      return fetchMock(`content_${safeId}`).catch(() => fetchMock("content_demo-001"));
    }
  }

  const res = await fetch(path);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function makeTopCards(summary) {
  const cards = [
    {
      title: "Total Impressions",
      big: fmt(summary.total_impressions),
      lines: [
        `Engagement Rate: ${(summary.engagement_rate * 100).toFixed(2)}%`,
        `Avg Watch Time: ${summary.avg_watch_time.toFixed(2)}`,
        `Share Rate: ${(summary.share_rate * 100).toFixed(2)}%`,
        `Save Rate: ${(summary.save_rate * 100).toFixed(2)}%`,
      ],
    },
    {
      title: "Period Change",
      big: `${summary.period_change_percent.toFixed(2)}%`,
      lines: ["vs previous period"],
    },
    {
      title: "Top Platform",
      big: summary.top_platform.name,
      lines: [
        `Avg 24h Impr/Post: ${fmt(summary.top_platform.avg_24h_per_post)}`,
        `Avg Eng Rate: ${(summary.top_platform.avg_engagement_rate * 100).toFixed(2)}%`,
      ],
    },
    {
      title: "Top Property",
      big: summary.top_property.name,
      lines: [
        `Impressions: ${fmt(summary.top_property.impressions)}`,
        `Engagement: ${(summary.top_property.engagement_rate * 100).toFixed(2)}%`,
      ],
    },
    {
      title: "Top Category",
      big: summary.top_category.name,
      lines: [
        `Posts: ${summary.top_category.post_count}`,
        `Perf vs Avg: ${(summary.top_category.performance_vs_avg * 100).toFixed(2)}%`,
      ],
    },
  ];

  document.getElementById("topMetrics").innerHTML = cards
    .map((card) => `<div class="metric-card"><small>${card.title}</small><div class="big">${card.big}</div>${card.lines.map((line) => `<div>${line}</div>`).join("")}</div>`)
    .join("");
}

function renderRankings(summary) {
  document.getElementById("propertiesRanking").innerHTML = summary.properties_ranking
    .map((p) => kv(`${p.property}`, `${fmt(p.impressions)} | ${(p.engagement_rate * 100).toFixed(2)}%`))
    .join("");

  document.getElementById("platformsRanking").innerHTML = summary.platforms_ranking
    .map((p) => kv(`${p.platform}`, `${fmt(p.impressions)} | ${(p.engagement_rate * 100).toFixed(2)}%`))
    .join("");

  const k = summary.kpis;
  document.getElementById("kpiList").innerHTML = [
    kv("Engagement Rate", `${(k.engagement_rate * 100).toFixed(2)}%`),
    kv("View-through Rate", `${(k.view_through_rate * 100).toFixed(2)}%`),
    kv("Avg Watch Time", `${k.avg_watch_time}`),
    kv("CTR", `${(k.ctr * 100).toFixed(2)}%`),
    kv("Shares-to-Views", `${(k.shares_to_views * 100).toFixed(2)}%`),
    kv("Saves-to-Views", `${(k.saves_to_views * 100).toFixed(2)}%`),
    kv("Posts Above Benchmark", `${(k.posts_above_benchmark * 100).toFixed(2)}%`),
    kv("Follower Change", `${k.follower_change}`),
  ].join("");

  const f = summary.funnel;
  document.getElementById("funnelBox").innerHTML = [
    kv("Views", fmt(f.views)),
    kv("Engagements", fmt(f.engagements)),
    kv("Clicks", fmt(f.clicks)),
    kv("Follows", fmt(f.follows)),
    kv("View → Engage", `${(f.engage_rate * 100).toFixed(2)}%`),
    kv("Engage → Click", `${(f.click_rate * 100).toFixed(2)}%`),
    kv("Click → Follow", `${(f.follow_rate * 100).toFixed(2)}%`),
  ].join("");
}

function renderTopContent(items) {
  state.sparkCharts.forEach((chart) => chart.destroy());
  state.sparkCharts = [];

  state.topContent = items;
  const container = document.getElementById("topContentGrid");
  container.innerHTML = items
    .map(
      (item) => `
      <article class="content-tile" data-id="${item.post_id}">
        <strong>${item.caption}</strong>
        <div>${item.platform} • ${item.property} • ${item.category}</div>
        <small>${item.tags.join(", ")}</small>
        <div class="spark-wrap"><canvas id="spark-${item.post_id}"></canvas></div>
        <div>${kv("Impressions", fmt(item.final_impressions))}${kv("Share Rate", `${(item.share_rate * 100).toFixed(2)}%`)}${kv("Save Rate", `${(item.save_rate * 100).toFixed(2)}%`)}${kv("Engagement", `${(item.engagement_rate * 100).toFixed(2)}%`)}</div>
      </article>`
    )
    .join("");

  items.forEach((item) => {
    const ctx = document.getElementById(`spark-${item.post_id}`);
    const spark = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["30m", "1h", "6h", "24h", "Final"],
        datasets: [{ data: item.sparkline, borderColor: "#38bdf8", pointRadius: 0, tension: 0.3 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    });
    state.sparkCharts.push(spark);
  });

  container.querySelectorAll(".content-tile").forEach((tile) => {
    tile.addEventListener("click", () => loadContentDetail(tile.getAttribute("data-id")));
  });
}

function renderInsights(summary, contentItems) {
  const top = contentItems[0];
  const changeDirection = summary.period_change_percent >= 0 ? "up" : "down";
  const strongestPlatform = summary.platforms_ranking[0];
  const weakestPlatform = summary.platforms_ranking[summary.platforms_ranking.length - 1];

  const insights = [
    `Performance is trending ${changeDirection} ${Math.abs(summary.period_change_percent).toFixed(2)}% versus the prior period, with ${fmt(summary.total_impressions)} total impressions.`,
    `${summary.top_property.name} leads properties with ${fmt(summary.top_property.impressions)} impressions and ${(summary.top_property.engagement_rate * 100).toFixed(2)}% engagement rate.`,
    `${strongestPlatform?.platform || "Top platform"} is your strongest platform by total impressions; ${weakestPlatform?.platform || "Lowest platform"} is the current optimization opportunity.`,
    top ? `Top post momentum: "${top.caption}" on ${top.platform} generated ${fmt(top.final_impressions)} final impressions at ${(top.engagement_rate * 100).toFixed(2)}% engagement.` : "No top post available for selected period.",
    `Funnel health: View→Engage ${(summary.funnel.engage_rate * 100).toFixed(2)}%, Engage→Click ${(summary.funnel.click_rate * 100).toFixed(2)}%, Click→Follow ${(summary.funnel.follow_rate * 100).toFixed(2)}%.`,
  ];

  document.getElementById("insightsList").innerHTML = insights.map((insight) => `<div class="insight-item">${insight}</div>`).join("");
}

function renderAdvancedCharts(summary) {
  const rankingPlatforms = summary.platforms_ranking.slice(0, 6);
  const rankingProperties = summary.properties_ranking.slice(0, 6);

  if (state.platformBarChart) state.platformBarChart.destroy();
  if (state.propertyMixChart) state.propertyMixChart.destroy();
  if (state.funnelMixChart) state.funnelMixChart.destroy();

  const platformCtx = document.getElementById("platformBarChart");
  state.platformBarChart = new Chart(platformCtx, {
    type: "bar",
    data: {
      labels: rankingPlatforms.map((item) => item.platform),
      datasets: [
        {
          label: "Impressions",
          data: rankingPlatforms.map((item) => item.impressions),
          backgroundColor: "rgba(56, 189, 248, 0.65)",
          borderColor: "#38bdf8",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(148, 163, 184, 0.15)" } },
        y: { ticks: { color: "#cbd5e1" }, grid: { color: "rgba(148, 163, 184, 0.12)" } },
      },
    },
  });

  const propertyCtx = document.getElementById("propertyMixChart");
  state.propertyMixChart = new Chart(propertyCtx, {
    type: "doughnut",
    data: {
      labels: rankingProperties.map((item) => item.property),
      datasets: [
        {
          data: rankingProperties.map((item) => item.impressions),
          backgroundColor: ["#22d3ee", "#38bdf8", "#34d399", "#a78bfa", "#f59e0b", "#f472b6"],
          borderColor: "#0b1220",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#cbd5e1" } } },
    },
  });

  const funnelCtx = document.getElementById("funnelMixChart");
  state.funnelMixChart = new Chart(funnelCtx, {
    type: "pie",
    data: {
      labels: ["Views", "Engagements", "Clicks", "Follows"],
      datasets: [
        {
          data: [summary.funnel.views, summary.funnel.engagements, summary.funnel.clicks, summary.funnel.follows],
          backgroundColor: ["#38bdf8", "#34d399", "#f59e0b", "#a78bfa"],
          borderColor: "#0b1220",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#cbd5e1" } } },
    },
  });
}

async function loadDashboard() {
  const summary = await api(`/dashboard_summary?period=${state.period}`);
  makeTopCards(summary);
  renderRankings(summary);
  const content = await api(`/top_content?period=${state.period}&limit=8`);
  renderTopContent(content.items);
  renderInsights(summary, content.items);
  renderAdvancedCharts(summary);
}

async function loadPlatformPropertyViews() {
  const [platforms, properties] = await Promise.all([
    api(`/platform_summary?period=${state.period}`),
    api(`/property_summary?period=${state.period}`),
  ]);

  const platformItems = platforms.platforms || [];
  const propertyItems = properties.properties || [];

  const topPlatforms = platformItems.slice(0, 3);
  document.getElementById("platformLeaderCards").innerHTML = topPlatforms
    .map(
      (item, index) => `
      <div class="leader-card">
        <div class="title">#${index + 1} ${item.platform}</div>
        <div>${kv("Impressions", fmt(item.impressions))}</div>
        <div>${kv("Engagement", `${(item.engagement_rate * 100).toFixed(2)}%`)}</div>
        <div>${kv("Avg 24h", fmt(item.avg_24h_impressions || 0))}</div>
      </div>`
    )
    .join("");

  const platformInsights = [
    topPlatforms[0]
      ? `${topPlatforms[0].platform} is leading with ${fmt(topPlatforms[0].impressions)} impressions this period.`
      : "No platform data for selected period.",
    topPlatforms.length > 1
      ? `${topPlatforms[1].platform} is the strongest challenger and may benefit from higher volume in top categories.`
      : "Not enough platform rows for comparative insight.",
    platformItems.length > 0
      ? `Average engagement across platforms is ${(platformItems.reduce((acc, p) => acc + p.engagement_rate, 0) / platformItems.length * 100).toFixed(2)}%.`
      : "No engagement trends available.",
  ];
  document.getElementById("platformInsights").innerHTML = platformInsights.map((text) => `<div class="insight-item">${text}</div>`).join("");

  const topProperties = propertyItems.slice(0, 3);
  document.getElementById("propertyLeaderCards").innerHTML = topProperties
    .map(
      (item, index) => `
      <div class="leader-card">
        <div class="title">#${index + 1} ${item.property}</div>
        <div>${kv("Impressions", fmt(item.impressions))}</div>
        <div>${kv("Engagement", `${(item.engagement_rate * 100).toFixed(2)}%`)}</div>
        <div>${kv("Avg 24h", fmt(item.avg_24h_impressions || 0))}</div>
      </div>`
    )
    .join("");

  const propertyInsights = [
    topProperties[0]
      ? `${topProperties[0].property} drives the largest share with ${fmt(topProperties[0].impressions)} impressions.`
      : "No property data for selected period.",
    topProperties.length > 1
      ? `${topProperties[1].property} is competitive and worth testing more highlight formats.`
      : "Not enough property rows for comparative insight.",
    propertyItems.length > 0
      ? `Average 24h performance by property is ${fmt(propertyItems.reduce((acc, p) => acc + (p.avg_24h_impressions || 0), 0) / propertyItems.length)} impressions.`
      : "No 24h property data available.",
  ];
  document.getElementById("propertyInsights").innerHTML = propertyInsights.map((text) => `<div class="insight-item">${text}</div>`).join("");

  document.getElementById("platformSummaryTable").innerHTML = `
    <div class="summary-table">
      <div class="table-row header"><div>Platform</div><div>Impressions</div><div>Engagement</div><div>Avg 24h</div></div>
      ${platformItems
        .map(
          (p) => `<div class="table-row"><div>${p.platform}</div><div>${fmt(p.impressions)}</div><div>${(p.engagement_rate * 100).toFixed(2)}%</div><div>${fmt(p.avg_24h_impressions || 0)}</div></div>`
        )
        .join("")}
    </div>
  `;

  document.getElementById("propertySummaryTable").innerHTML = `
    <div class="summary-table">
      <div class="table-row header"><div>Property</div><div>Impressions</div><div>Engagement</div><div>Avg 24h</div></div>
      ${propertyItems
        .map(
          (p) => `<div class="table-row"><div>${p.property}</div><div>${fmt(p.impressions)}</div><div>${(p.engagement_rate * 100).toFixed(2)}%</div><div>${fmt(p.avg_24h_impressions || 0)}</div></div>`
        )
        .join("")}
    </div>
  `;

  if (state.platformsPageBarChart) state.platformsPageBarChart.destroy();
  if (state.platformsPageEngChart) state.platformsPageEngChart.destroy();
  if (state.propertiesPageBarChart) state.propertiesPageBarChart.destroy();
  if (state.propertiesPageLiftChart) state.propertiesPageLiftChart.destroy();

  state.platformsPageBarChart = new Chart(document.getElementById("platformsPageBarChart"), {
    type: "bar",
    data: {
      labels: platformItems.map((p) => p.platform),
      datasets: [{ label: "Impressions", data: platformItems.map((p) => p.impressions), backgroundColor: "rgba(56,189,248,0.65)", borderColor: "#38bdf8", borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  state.platformsPageEngChart = new Chart(document.getElementById("platformsPageEngChart"), {
    type: "line",
    data: {
      labels: platformItems.map((p) => p.platform),
      datasets: [{ label: "Engagement Rate", data: platformItems.map((p) => p.engagement_rate * 100), borderColor: "#34d399", backgroundColor: "rgba(52,211,153,0.2)", tension: 0.35 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  state.propertiesPageBarChart = new Chart(document.getElementById("propertiesPageBarChart"), {
    type: "bar",
    data: {
      labels: propertyItems.map((p) => p.property),
      datasets: [{ label: "Impressions", data: propertyItems.map((p) => p.impressions), backgroundColor: "rgba(167,139,250,0.65)", borderColor: "#a78bfa", borderWidth: 1 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  state.propertiesPageLiftChart = new Chart(document.getElementById("propertiesPageLiftChart"), {
    type: "line",
    data: {
      labels: propertyItems.map((p) => p.property),
      datasets: [{ label: "Avg 24h Impressions", data: propertyItems.map((p) => p.avg_24h_impressions || 0), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.2)", tension: 0.35 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
}

function renderDetail(detail) {
  document.getElementById("contentPrompt").classList.add("hidden");
  document.getElementById("contentDetail").classList.remove("hidden");

  const p = detail.post;
  document.getElementById("detailHeader").innerHTML = `
    <h4>${p.caption}</h4>
    <div>${p.platform} | ${new Date(p.published_at).toLocaleString()} | ${p.property} | ${p.category}</div>
    <small>${p.tags.join(", ")} | <a href="${p.url}" target="_blank">Native Post</a></small>
  `;

  document.getElementById("platformMetrics").innerHTML = Object.entries(detail.platform_metrics)
    .map(([key, value]) => kv(key.replaceAll("_", " "), typeof value === "number" ? fmt(value) : value))
    .join("");

  document.getElementById("referralSources").innerHTML = Object.entries(detail.referrals)
    .map(([key, value]) => kv(key.replaceAll("_", " "), fmt(value)))
    .join("");

  document.getElementById("bottomDetail").innerHTML = `
    <div><strong>Notes:</strong> ${detail.notes}</div>
    <div><strong>Benchmark:</strong> ${detail.benchmark.summary}</div>
    <div><strong>Related Posts:</strong> ${detail.related_posts.map((rp) => `${rp.platform}: ${rp.caption}`).join(" | ")}</div>
  `;

  const ctx = document.getElementById("detailChart");
  if (state.detailChart) state.detailChart.destroy();
  state.detailChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: detail.curves.labels,
      datasets: [
        { label: "Impressions", data: detail.curves.impressions, borderColor: "#22d3ee" },
        { label: "Engagement Rate", data: detail.curves.engagement_rate, borderColor: "#f59e0b" },
        { label: "Share Velocity", data: detail.curves.share_velocity, borderColor: "#a78bfa" },
        { label: "Watch Time", data: detail.curves.watch_time, borderColor: "#34d399" },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } },
  });

  document.querySelector('[data-tab="content"]').click();
}

async function loadContentDetail(postId) {
  const detail = await api(`/content/${postId}`);
  renderDetail(detail);
}

function buildSingleForm() {
  const points = ["30m", "1h", "6h", "24h", "final"];
  const baseFields = [
    ["platform", "TikTok"],
    ["url", "https://example.com/post/123"],
    ["property", "NBA"],
    ["category", "Highlight"],
    ["tags", "NBA|playoffs|guard"],
    ["caption", "Sample caption"],
    ["notes", "Player reposted at 8:45pm"],
    ["published_at", new Date().toISOString()],
    ["video_duration", "90"],
    ["home_feed", "12000"],
    ["explore", "3500"],
    ["search", "800"],
    ["profile_visits", "600"],
    ["external_embeds", "400"],
    ["reposts", "500"],
    ["aggregators", "100"],
  ];

  const metrics = ["impressions", "views", "engagements", "shares", "saves", "watch_time", "retention_rate", "ctr", "follower_gain"];
  points.forEach((point) => {
    metrics.forEach((metric) => baseFields.push([`${point}_${metric}`, "0"]));
    baseFields.push([`${point}_note`, ""]);
  });

  document.getElementById("singlePostForm").innerHTML = baseFields
    .map(([field, value]) => `<label>${field}<input name="${field}" value="${value}" /></label>`)
    .join("");
}

async function submitSinglePost() {
  if (isGitHubPages) {
    document.getElementById("singleResult").textContent = "Disabled in GitHub Pages demo mode.";
    return;
  }

  const form = document.getElementById("singlePostForm");
  const data = Object.fromEntries(new FormData(form).entries());

  const perf = {};
  ["30m", "1h", "6h", "24h", "final"].forEach((p) => {
    perf[p] = {
      impressions: Number(data[`${p}_impressions`] || 0),
      views: Number(data[`${p}_views`] || 0),
      engagements: Number(data[`${p}_engagements`] || 0),
      shares: Number(data[`${p}_shares`] || 0),
      saves: Number(data[`${p}_saves`] || 0),
      watch_time: Number(data[`${p}_watch_time`] || 0),
      retention_rate: Number(data[`${p}_retention_rate`] || 0),
      ctr: Number(data[`${p}_ctr`] || 0),
      follower_gain: Number(data[`${p}_follower_gain`] || 0),
      note: data[`${p}_note`] || "",
    };
  });

  const payload = {
    post_id: `single-${Date.now()}`,
    platform: data.platform,
    url: data.url,
    property: data.property,
    category: data.category,
    tags: (data.tags || "").split("|").map((v) => v.trim()).filter(Boolean),
    caption: data.caption,
    notes: data.notes,
    published_at: data.published_at,
    video_duration: Number(data.video_duration || 90),
    performance: perf,
    referrals: {
      home_feed: Number(data.home_feed || 0),
      explore: Number(data.explore || 0),
      search: Number(data.search || 0),
      profile_visits: Number(data.profile_visits || 0),
      external_embeds: Number(data.external_embeds || 0),
      reposts: Number(data.reposts || 0),
      aggregators: Number(data.aggregators || 0),
    },
  };

  const res = await fetch("/add_post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  document.getElementById("singleResult").textContent = `Added: ${result.post_id}`;
  await loadDashboard();
  await loadPlatformPropertyViews();
}

async function submitBulk() {
  if (isGitHubPages) {
    document.getElementById("bulkResult").textContent = "Disabled in GitHub Pages demo mode.";
    return;
  }

  const fileInput = document.getElementById("bulkFile");
  const file = fileInput.files[0];
  if (!file) return;

  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/bulk_upload", { method: "POST", body: form });
  const result = await res.json();

  document.getElementById("bulkResult").innerHTML = `Added: ${result.added}<br/>Errors: ${result.errors.join(" | ") || "None"}`;
  document.getElementById("bulkPreview").innerHTML = `<pre>${JSON.stringify(result.preview_rows, null, 2)}</pre>`;

  await loadDashboard();
  await loadPlatformPropertyViews();
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });
}

async function init() {
  initTabs();
  buildSingleForm();

  document.getElementById("periodSelect").addEventListener("change", async (event) => {
    state.period = event.target.value;
    await loadDashboard();
    await loadPlatformPropertyViews();
  });

  document.getElementById("submitSingle").addEventListener("click", submitSinglePost);
  document.getElementById("submitBulk").addEventListener("click", submitBulk);

  await loadDashboard();
  await loadPlatformPropertyViews();
}

init();
