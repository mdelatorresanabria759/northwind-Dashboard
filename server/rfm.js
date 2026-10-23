const Database = require('better-sqlite3');
const path = require('path');

function getRFMAnalysis(db) {
  const query = `
    SELECT 
      c.customerid,
      c.companyname,
      c.country,
      c.city,
      COUNT(DISTINCT o.orderid) AS frequency,
      COALESCE(ROUND(SUM(od.unitprice * od.quantity * (1.0 - od.discount)), 2), 0.0) AS monetary,
      MAX(o.orderdate) AS last_order_date,
      CASE 
        WHEN MAX(o.orderdate) IS NULL THEN 999 
        ELSE CAST(ROUND(JULIANDAY('1998-05-06 05:00:16') - JULIANDAY(MAX(o.orderdate))) AS INT)
      END AS recency_days
    FROM customers c
    LEFT JOIN orders o ON c.customerid = o.customerid
    LEFT JOIN order_details od ON o.orderid = od.orderid
    GROUP BY c.customerid, c.companyname, c.country, c.city
  `;
  const customers = db.prepare(query).all();

  // Active customers for quantile thresholds
  const active = customers.filter(c => c.frequency > 0);
  
  // Sort copies to determine quartiles
  const rSorted = active.map(c => c.recency_days).sort((a,b)=>a-b);
  const fSorted = active.map(c => c.frequency).sort((a,b)=>a-b);
  const mSorted = active.map(c => c.monetary).sort((a,b)=>a-b);

  const q = (arr, p) => arr[Math.floor(arr.length * p)];
  
  const rCutoffs = [q(rSorted, 0.25), q(rSorted, 0.50), q(rSorted, 0.75)]; // Lower recency days = better
  const fCutoffs = [q(fSorted, 0.25), q(fSorted, 0.50), q(fSorted, 0.75)]; // Higher frequency = better
  const mCutoffs = [q(mSorted, 0.25), q(mSorted, 0.50), q(mSorted, 0.75)]; // Higher monetary = better

  const scored = customers.map(c => {
    if (c.frequency === 0) {
      return {
        ...c,
        r_score: 1,
        f_score: 1,
        m_score: 1,
        rfm_score: '111',
        segment: 'Inactivo / Sin Compras'
      };
    }

    // Recency: Lower days -> higher score (4 is freshest)
    let r_score = 1;
    if (c.recency_days <= rCutoffs[0]) r_score = 4;
    else if (c.recency_days <= rCutoffs[1]) r_score = 3;
    else if (c.recency_days <= rCutoffs[2]) r_score = 2;
    else r_score = 1;

    // Frequency: Higher freq -> higher score
    let f_score = 1;
    if (c.frequency >= fCutoffs[2]) f_score = 4;
    else if (c.frequency >= fCutoffs[1]) f_score = 3;
    else if (c.frequency >= fCutoffs[0]) f_score = 2;
    else f_score = 1;

    // Monetary: Higher monetary -> higher score
    let m_score = 1;
    if (c.monetary >= mCutoffs[2]) m_score = 4;
    else if (c.monetary >= mCutoffs[1]) m_score = 3;
    else if (c.monetary >= mCutoffs[0]) m_score = 2;
    else m_score = 1;

    // Segment Classification
    let segment = 'Clientes Comunes';
    if (r_score >= 3 && f_score >= 3 && m_score >= 3) {
      segment = 'Campeones (VIP)';
    } else if (r_score >= 3 && f_score >= 3) {
      segment = 'Clientes Leales';
    } else if (r_score >= 3 && f_score <= 2) {
      segment = 'Nuevos / Prometedores';
    } else if (r_score === 2 && f_score >= 3) {
      segment = 'Necesitan Atención';
    } else if (r_score === 1 && f_score >= 3) {
      segment = 'En Riesgo de Fuga';
    } else if (r_score === 1 && f_score <= 2) {
      segment = 'En Hibernación / Perdidos';
    }

    return {
      ...c,
      r_score,
      f_score,
      m_score,
      rfm_score: `${r_score}${f_score}${m_score}`,
      segment
    };
  });

  // Summary by segment
  const segmentSummary = {};
  scored.forEach(c => {
    if (!segmentSummary[c.segment]) {
      segmentSummary[c.segment] = {
        count: 0,
        total_monetary: 0,
        avg_frequency: 0,
        avg_recency: 0
      };
    }
    segmentSummary[c.segment].count += 1;
    segmentSummary[c.segment].total_monetary += c.monetary;
    segmentSummary[c.segment].avg_frequency += c.frequency;
    segmentSummary[c.segment].avg_recency += c.recency_days;
  });

  Object.keys(segmentSummary).forEach(seg => {
    const s = segmentSummary[seg];
    s.avg_monetary = Number((s.total_monetary / s.count).toFixed(2));
    s.avg_frequency = Number((s.avg_frequency / s.count).toFixed(1));
    s.avg_recency = Number((s.avg_recency / s.count).toFixed(1));
    s.total_monetary = Number(s.total_monetary.toFixed(2));
  });

  return {
    cutoffs: { rCutoffs, fCutoffs, mCutoffs },
    customers: scored,
    summary: segmentSummary
  };
}

module.exports = { getRFMAnalysis };
