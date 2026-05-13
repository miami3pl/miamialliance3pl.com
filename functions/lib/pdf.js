'use strict';

const DEFAULT_PAGE = { width: 612, height: 792 }; // US Letter in points

function fmtNumber(n, digits = 4) {
    if (!Number.isFinite(n)) return '0';
    // Avoid scientific notation; trim trailing zeros.
    const s = n.toFixed(digits);
    return s.replace(/\.?0+$/, '');
}

function pdfEscapeText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/[\r\n]+/g, ' ');
}

function rgb(r, g, b) {
    return `${fmtNumber(r)} ${fmtNumber(g)} ${fmtNumber(b)}`;
}

function hexToRgb01(hex) {
    const clean = String(hex).replace('#', '');
    if (clean.length !== 6) return [0, 0, 0];
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return [r, g, b];
}

const COLORS = {
    darkNavy: hexToRgb01('#0f172a'),
    primary: hexToRgb01('#1e3a5f'),
    accent: hexToRgb01('#14b8a6'),
    gray: hexToRgb01('#64748b'),
    lightGray: hexToRgb01('#f1f5f9'),
    border: hexToRgb01('#e2e8f0'),
    white: [1, 1, 1],
    noteBg: hexToRgb01('#fef9c3'),
    noteBorder: hexToRgb01('#facc15'),
    noteText: hexToRgb01('#92400e')
};

function buildPdf({ contentStream, page = DEFAULT_PAGE }) {
    const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary');

    const objects = [];

    const writeObj = (id, body) => {
        const buf = Buffer.from(`${id} 0 obj\n${body}\nendobj\n`, 'utf8');
        objects.push({ id, buf });
    };

    // Fonts
    writeObj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    writeObj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    const streamBuf = Buffer.from(contentStream, 'utf8');
    const streamObjBody = `<< /Length ${streamBuf.length} >>\nstream\n${contentStream}\nendstream`;
    writeObj(6, streamObjBody);

    const pageObjBody =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
        `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> ` +
        `/Contents 6 0 R >>`;
    writeObj(3, pageObjBody);

    writeObj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');

    // Sort objects by id for stable xref generation.
    objects.sort((a, b) => a.id - b.id);

    const chunks = [header];
    const offsets = new Map();
    let offset = header.length;

    for (const obj of objects) {
        offsets.set(obj.id, offset);
        chunks.push(obj.buf);
        offset += obj.buf.length;
    }

    const xrefStart = offset;
    const size = Math.max(...objects.map(o => o.id)) + 1;

    let xref = `xref\n0 ${size}\n`;
    xref += '0000000000 65535 f \n';
    for (let i = 1; i < size; i++) {
        const off = offsets.get(i) || 0;
        xref += `${String(off).padStart(10, '0')} 00000 n \n`;
    }

    const trailer =
        `trailer\n<< /Size ${size} /Root 1 0 R >>\n` +
        `startxref\n${xrefStart}\n%%EOF\n`;

    chunks.push(Buffer.from(xref + trailer, 'utf8'));
    return Buffer.concat(chunks);
}

function money(value) {
    const n = Number(value) || 0;
    return `$${n.toFixed(2)}`;
}

function isTruthy(value) {
    if (typeof value === 'boolean') return value;
    const s = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'on'].includes(s);
}

function makeQuoteNumber(now = new Date()) {
    const dateKey = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 10000);
    return `MA3PL-${dateKey}-${String(rand).padStart(4, '0')}`;
}

function formatDateLong(date) {
    try {
        return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
    } catch {
        return date.toISOString().slice(0, 10);
    }
}

function pdfText({ x, y, text, size = 10, font = 'F1', color = COLORS.primary }) {
    const [r, g, b] = color;
    const escaped = pdfEscapeText(text);
    return [
        `${rgb(r, g, b)} rg`,
        'BT',
        `/${font} ${fmtNumber(size, 2)} Tf`,
        `1 0 0 1 ${fmtNumber(x, 2)} ${fmtNumber(y, 2)} Tm`,
        `(${escaped}) Tj`,
        'ET'
    ].join('\n');
}

function pdfRectFill({ x, y, w, h, color }) {
    const [r, g, b] = color;
    return [
        `${rgb(r, g, b)} rg`,
        `${fmtNumber(x, 2)} ${fmtNumber(y, 2)} ${fmtNumber(w, 2)} ${fmtNumber(h, 2)} re`,
        'f'
    ].join('\n');
}

function pdfLine({ x1, y1, x2, y2, color = COLORS.border, width = 1 }) {
    const [r, g, b] = color;
    return [
        `${rgb(r, g, b)} RG`,
        `${fmtNumber(width, 2)} w`,
        `${fmtNumber(x1, 2)} ${fmtNumber(y1, 2)} m`,
        `${fmtNumber(x2, 2)} ${fmtNumber(y2, 2)} l`,
        'S'
    ].join('\n');
}

function generateCustomQuotePdfBuffer(input) {
    const now = new Date();

    const pallets = Math.max(0, Math.floor(Number(input.pallets ?? input.num_pallets ?? 0)));
    const days = Math.max(1, Math.floor(Number(input.days ?? input.storage_days ?? 30)));
    const includeWrap = input.include_wrap !== undefined ? isTruthy(input.include_wrap) : isTruthy(input.black_wrap ?? true);

    const storageRate = Number(input.storage_rate ?? 0.75);
    const inboundRate = Number(input.inbound_rate ?? 15.0);
    const outboundRate = Number(input.outbound_rate ?? 15.0);
    const wrapRate = Number(input.wrap_rate ?? 7.0);

    const quoteNumber = input.quote_number ? String(input.quote_number) : makeQuoteNumber(now);

    const storageTotal = pallets * days * storageRate;
    const inboundTotal = pallets * inboundRate;
    const outboundTotal = pallets * outboundRate;
    const wrapTotal = includeWrap ? pallets * wrapRate : 0;
    const oneTimeTotal = inboundTotal + outboundTotal + wrapTotal;
    const firstMonthTotal = storageTotal + oneTimeTotal;
    const ongoingPerDay = pallets * storageRate;

    const currentDateStr = formatDateLong(now);
    const validThrough = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const validThroughStr = formatDateLong(validThrough);

    const margin = 36;
    const pageW = DEFAULT_PAGE.width;
    const pageH = DEFAULT_PAGE.height;

    const headerH = 120;
    const infoBarH = 30;
    const headerY = pageH - headerH;
    const infoY = headerY - infoBarH;

    const lines = [];

    // Header bars
    lines.push(pdfRectFill({ x: 0, y: headerY, w: pageW, h: headerH, color: COLORS.darkNavy }));
    lines.push(pdfRectFill({ x: 0, y: headerY, w: pageW, h: 6, color: COLORS.accent }));

    // Header text
    lines.push(pdfText({ x: margin, y: pageH - 52, text: 'MIAMI ALLIANCE', size: 28, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: margin, y: pageH - 84, text: '3PL', size: 28, font: 'F2', color: COLORS.accent }));
    lines.push(pdfText({
        x: margin,
        y: pageH - 106,
        text: 'WAREHOUSING  |  FULFILLMENT  |  LOGISTICS',
        size: 10,
        font: 'F1',
        color: [148 / 255, 163 / 255, 184 / 255]
    }));
    lines.push(pdfText({
        x: pageW - margin - 120,
        y: pageH - 78,
        text: 'CUSTOM QUOTE',
        size: 14,
        font: 'F2',
        color: COLORS.white
    }));

    // Info bar
    lines.push(pdfRectFill({ x: 0, y: infoY, w: pageW, h: infoBarH, color: COLORS.lightGray }));
    lines.push(pdfText({ x: margin, y: infoY + 10, text: `QUOTE #: ${quoteNumber}`, size: 10, font: 'F2', color: COLORS.primary }));
    lines.push(pdfText({
        x: pageW / 2 - 70,
        y: infoY + 10,
        text: `Date: ${currentDateStr}`,
        size: 10,
        font: 'F1',
        color: COLORS.gray
    }));
    lines.push(pdfText({
        x: pageW - margin - 200,
        y: infoY + 10,
        text: `Valid through: ${validThroughStr}`,
        size: 10,
        font: 'F1',
        color: COLORS.gray
    }));

    // Body heading
    let y = infoY - 30;
    lines.push(pdfText({ x: margin, y, text: 'CUSTOM STORAGE QUOTE', size: 18, font: 'F2', color: COLORS.primary }));
    y -= 18;
    lines.push(pdfText({
        x: margin,
        y,
        text: `${pallets} Pallets  |  ${days} Days Storage`,
        size: 11,
        font: 'F1',
        color: COLORS.gray
    }));
    y -= 22;

    // Table header
    const tableX = margin;
    const tableW = pageW - margin * 2;
    const rowH = 18;
    lines.push(pdfRectFill({ x: tableX, y: y - rowH + 4, w: tableW, h: rowH, color: COLORS.primary }));
    lines.push(pdfText({ x: tableX + 6, y: y - 10, text: 'Service', size: 10, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: tableX + 290, y: y - 10, text: 'Qty', size: 10, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: tableX + 340, y: y - 10, text: 'Rate', size: 10, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: tableX + 430, y: y - 10, text: 'Duration', size: 10, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: tableX + 520, y: y - 10, text: 'Amount', size: 10, font: 'F2', color: COLORS.white }));
    y -= rowH + 6;

    const rows = [
        ['Pallet Storage', String(pallets), '$0.75/pallet/day', `${days} days`, money(storageTotal)],
        ['Receiving & Intake (Inbound)', String(pallets), `${money(inboundRate)}/pallet`, 'One-time', money(inboundTotal)],
        ['Pallet Handling (Outbound / Release)', String(pallets), `${money(outboundRate)}/pallet`, 'One-time', money(outboundTotal)]
    ];
    if (includeWrap) {
        rows.push(['Black Wrapping', String(pallets), `${money(wrapRate)}/pallet`, 'One-time', money(wrapTotal)]);
    }

    for (const r of rows) {
        lines.push(pdfText({ x: tableX + 6, y: y, text: r[0], size: 10, font: 'F1', color: COLORS.primary }));
        lines.push(pdfText({ x: tableX + 292, y, text: r[1], size: 10, font: 'F1', color: COLORS.gray }));
        lines.push(pdfText({ x: tableX + 342, y, text: r[2], size: 10, font: 'F1', color: COLORS.gray }));
        lines.push(pdfText({ x: tableX + 432, y, text: r[3], size: 10, font: 'F1', color: COLORS.gray }));
        lines.push(pdfText({ x: tableX + 522, y, text: r[4], size: 10, font: 'F2', color: COLORS.primary }));
        y -= 14;
    }

    y -= 10;

    // Totals
    const totalsX = pageW - margin - 240;
    const totalsYTop = y;
    lines.push(pdfRectFill({ x: totalsX, y: totalsYTop - 92, w: 240, h: 92, color: COLORS.lightGray }));
    lines.push(pdfLine({ x1: totalsX, y1: totalsYTop - 92, x2: totalsX + 240, y2: totalsYTop - 92, color: COLORS.border, width: 1 }));
    lines.push(pdfRectFill({ x: totalsX, y: totalsYTop - 6, w: 240, h: 6, color: COLORS.accent }));
    lines.push(pdfText({ x: totalsX + 10, y: totalsYTop - 20, text: `Storage (${days}d)`, size: 10, font: 'F1', color: COLORS.gray }));
    lines.push(pdfText({ x: totalsX + 150, y: totalsYTop - 20, text: money(storageTotal), size: 10, font: 'F2', color: COLORS.primary }));
    lines.push(pdfText({ x: totalsX + 10, y: totalsYTop - 36, text: 'One-time services', size: 10, font: 'F1', color: COLORS.gray }));
    lines.push(pdfText({ x: totalsX + 150, y: totalsYTop - 36, text: money(oneTimeTotal), size: 10, font: 'F2', color: COLORS.primary }));
    lines.push(pdfLine({ x1: totalsX + 10, y1: totalsYTop - 44, x2: totalsX + 230, y2: totalsYTop - 44, color: COLORS.border, width: 1 }));
    lines.push(pdfText({ x: totalsX + 10, y: totalsYTop - 60, text: `TOTAL (${days}d)`, size: 11, font: 'F2', color: COLORS.primary }));
    lines.push(pdfText({ x: totalsX + 150, y: totalsYTop - 60, text: money(firstMonthTotal), size: 12, font: 'F2', color: COLORS.accent }));
    lines.push(pdfText({ x: totalsX + 10, y: totalsYTop - 78, text: 'Ongoing storage', size: 10, font: 'F1', color: COLORS.gray }));
    lines.push(pdfText({
        x: totalsX + 150,
        y: totalsYTop - 78,
        text: `${money(ongoingPerDay)}/day`,
        size: 10,
        font: 'F2',
        color: COLORS.primary
    }));

    // Notes
    const notesYTop = totalsYTop - 110;
    lines.push(pdfRectFill({ x: margin, y: notesYTop - 70, w: tableW, h: 70, color: COLORS.noteBg }));
    lines.push(pdfLine({ x1: margin, y1: notesYTop - 70, x2: margin + tableW, y2: notesYTop - 70, color: COLORS.noteBorder, width: 1 }));
    lines.push(pdfText({ x: margin + 10, y: notesYTop - 16, text: 'IMPORTANT NOTES', size: 10, font: 'F2', color: COLORS.noteText }));
    const noteLines = [
        'This quote is an estimate. Final billing may vary based on actual services performed.',
        'Storage continues at $0.75/pallet/day after the initial storage period.',
        'Outbound handling is billed when pallets are released/shipped. Taxes are not included.'
    ];
    let ny = notesYTop - 32;
    for (const n of noteLines) {
        lines.push(pdfText({ x: margin + 10, y: ny, text: `• ${n}`, size: 9, font: 'F1', color: COLORS.noteText }));
        ny -= 14;
    }

    // Footer
    lines.push(pdfLine({ x1: margin, y1: 72, x2: pageW - margin, y2: 72, color: COLORS.border, width: 1 }));
    lines.push(pdfText({
        x: pageW / 2 - 120,
        y: 54,
        text: '8780 NW 100th ST, Medley, FL 33178',
        size: 9,
        font: 'F1',
        color: COLORS.gray
    }));
    lines.push(pdfText({
        x: pageW / 2 - 150,
        y: 40,
        text: 'contact@miamialliance3pl.com  |  www.miamialliance3pl.com',
        size: 9,
        font: 'F1',
        color: COLORS.gray
    }));

    const contentStream = lines.join('\n') + '\n';
    const buffer = buildPdf({ contentStream });

    return {
        buffer,
        quoteNumber,
        filename: `MiamiAlliance3PL_CustomQuote_${quoteNumber}.pdf`,
        totals: {
            storageTotal,
            oneTimeTotal,
            firstMonthTotal,
            ongoingPerDay
        }
    };
}

function normalizeInvoice(invoice) {
    const inv = invoice || {};
    const lineItems = Array.isArray(inv.line_items) ? inv.line_items : [];
    return {
        invoice_number: inv.invoice_number || inv.number || 'INVOICE',
        customer_name: inv.customer_name || 'Customer',
        customer_email: inv.customer_email || '',
        billing_period_start: inv.billing_period_start || '',
        billing_period_end: inv.billing_period_end || '',
        due_date: inv.due_date || '',
        status: inv.status || '',
        line_items: lineItems.map(li => ({
            description: li.description || '',
            quantity: li.quantity ?? '',
            rate: li.rate ?? '',
            amount: li.amount ?? li.total ?? ''
        })),
        subtotal: Number(inv.subtotal ?? inv.total ?? 0),
        tax_amount: Number(inv.tax_amount ?? 0),
        total: Number(inv.total ?? 0),
        amount_paid: Number(inv.amount_paid ?? 0),
        notes: inv.notes || ''
    };
}

function generateInvoicePdfBuffer(invoiceInput) {
    const inv = normalizeInvoice(invoiceInput);
    const now = new Date();
    const margin = 36;
    const pageW = DEFAULT_PAGE.width;
    const pageH = DEFAULT_PAGE.height;

    const headerH = 110;
    const headerY = pageH - headerH;

    const lines = [];
    lines.push(pdfRectFill({ x: 0, y: headerY, w: pageW, h: headerH, color: COLORS.darkNavy }));
    lines.push(pdfRectFill({ x: 0, y: headerY, w: pageW, h: 6, color: COLORS.accent }));

    lines.push(pdfText({ x: margin, y: pageH - 52, text: 'MIAMI ALLIANCE 3PL', size: 22, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: margin, y: pageH - 78, text: 'INVOICE', size: 18, font: 'F2', color: COLORS.accent }));

    // Meta
    const metaY = headerY - 18;
    lines.push(pdfText({ x: margin, y: metaY, text: `Invoice #: ${inv.invoice_number}`, size: 11, font: 'F2', color: COLORS.primary }));
    lines.push(pdfText({ x: margin + 260, y: metaY, text: `Date: ${formatDateLong(now)}`, size: 10, font: 'F1', color: COLORS.gray }));
    if (inv.due_date) {
        lines.push(pdfText({ x: margin + 420, y: metaY, text: `Due: ${inv.due_date}`, size: 10, font: 'F1', color: COLORS.gray }));
    }

    // Customer block
    let y = metaY - 24;
    lines.push(pdfText({ x: margin, y, text: 'Bill To:', size: 10, font: 'F2', color: COLORS.primary }));
    y -= 14;
    lines.push(pdfText({ x: margin, y, text: inv.customer_name, size: 10, font: 'F1', color: COLORS.primary }));
    if (inv.customer_email) {
        y -= 14;
        lines.push(pdfText({ x: margin, y, text: inv.customer_email, size: 10, font: 'F1', color: COLORS.gray }));
    }
    y -= 20;
    if (inv.billing_period_start || inv.billing_period_end) {
        lines.push(pdfText({
            x: margin,
            y,
            text: `Billing Period: ${inv.billing_period_start} to ${inv.billing_period_end}`,
            size: 10,
            font: 'F1',
            color: COLORS.gray
        }));
        y -= 18;
    }

    // Line items header
    const tableX = margin;
    const tableW = pageW - margin * 2;
    const headerRowH = 18;
    lines.push(pdfRectFill({ x: tableX, y: y - headerRowH + 4, w: tableW, h: headerRowH, color: COLORS.primary }));
    lines.push(pdfText({ x: tableX + 6, y: y - 10, text: 'Description', size: 10, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: tableX + 350, y: y - 10, text: 'Qty', size: 10, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: tableX + 410, y: y - 10, text: 'Rate', size: 10, font: 'F2', color: COLORS.white }));
    lines.push(pdfText({ x: tableX + 500, y: y - 10, text: 'Amount', size: 10, font: 'F2', color: COLORS.white }));
    y -= headerRowH + 8;

    const maxRows = 22;
    const items = inv.line_items.slice(0, maxRows);
    for (const li of items) {
        const desc = String(li.description || '').slice(0, 70);
        lines.push(pdfText({ x: tableX + 6, y, text: desc, size: 10, font: 'F1', color: COLORS.primary }));
        lines.push(pdfText({ x: tableX + 352, y, text: String(li.quantity ?? ''), size: 10, font: 'F1', color: COLORS.gray }));
        lines.push(pdfText({ x: tableX + 412, y, text: li.rate !== '' ? money(li.rate) : '', size: 10, font: 'F1', color: COLORS.gray }));
        lines.push(pdfText({ x: tableX + 502, y, text: li.amount !== '' ? money(li.amount) : '', size: 10, font: 'F2', color: COLORS.primary }));
        y -= 14;
    }
    if (inv.line_items.length > maxRows) {
        lines.push(pdfText({
            x: tableX + 6,
            y,
            text: `… ${inv.line_items.length - maxRows} more line item(s) not shown`,
            size: 9,
            font: 'F1',
            color: COLORS.gray
        }));
        y -= 14;
    }

    // Totals
    const totalsX = pageW - margin - 220;
    const totalsYTop = Math.max(160, y - 10);
    lines.push(pdfRectFill({ x: totalsX, y: totalsYTop - 80, w: 220, h: 80, color: COLORS.lightGray }));
    lines.push(pdfRectFill({ x: totalsX, y: totalsYTop - 6, w: 220, h: 6, color: COLORS.accent }));
    lines.push(pdfText({ x: totalsX + 10, y: totalsYTop - 22, text: 'Subtotal', size: 10, font: 'F1', color: COLORS.gray }));
    lines.push(pdfText({ x: totalsX + 130, y: totalsYTop - 22, text: money(inv.subtotal), size: 10, font: 'F2', color: COLORS.primary }));
    lines.push(pdfText({ x: totalsX + 10, y: totalsYTop - 38, text: 'Tax', size: 10, font: 'F1', color: COLORS.gray }));
    lines.push(pdfText({ x: totalsX + 130, y: totalsYTop - 38, text: money(inv.tax_amount), size: 10, font: 'F2', color: COLORS.primary }));
    lines.push(pdfLine({ x1: totalsX + 10, y1: totalsYTop - 44, x2: totalsX + 210, y2: totalsYTop - 44, color: COLORS.border, width: 1 }));
    lines.push(pdfText({ x: totalsX + 10, y: totalsYTop - 60, text: 'Total', size: 11, font: 'F2', color: COLORS.primary }));
    lines.push(pdfText({ x: totalsX + 130, y: totalsYTop - 60, text: money(inv.total), size: 12, font: 'F2', color: COLORS.accent }));

    // Footer
    lines.push(pdfLine({ x1: margin, y1: 72, x2: pageW - margin, y2: 72, color: COLORS.border, width: 1 }));
    lines.push(pdfText({
        x: pageW / 2 - 120,
        y: 54,
        text: '8780 NW 100th ST, Medley, FL 33178',
        size: 9,
        font: 'F1',
        color: COLORS.gray
    }));
    lines.push(pdfText({
        x: pageW / 2 - 150,
        y: 40,
        text: 'contact@miamialliance3pl.com  |  www.miamialliance3pl.com',
        size: 9,
        font: 'F1',
        color: COLORS.gray
    }));

    const contentStream = lines.join('\n') + '\n';
    const buffer = buildPdf({ contentStream });
    return {
        buffer,
        filename: `${inv.invoice_number}.pdf`,
        invoiceNumber: inv.invoice_number
    };
}

module.exports = {
    generateCustomQuotePdfBuffer,
    generateInvoicePdfBuffer,
    makeQuoteNumber
};

