import io
import re
from datetime import date
from typing import Optional

import pikepdf
import pdfplumber

from models.schemas import Transaction


MONTH_MAP = {
    'JANUARI': 1, 'FEBRUARI': 2, 'MARET': 3, 'APRIL': 4,
    'MEI': 5, 'JUNI': 6, 'JULI': 7, 'AGUSTUS': 8,
    'SEPTEMBER': 9, 'OKTOBER': 10, 'NOVEMBER': 11, 'DESEMBER': 12,
}

_TX_START    = re.compile(r'^\d{2}/\d{2}\s')
_AMOUNT_RE   = re.compile(r'([\d,]+\.\d{2})')
_MERCHANT_RE = re.compile(r'00000\.00(.+)')
_PERIOD_RE   = re.compile(r'PERIODE\s*:\s*(\w+)\s+(\d{4})')

_SKIP_EXACT = {
    'Bersambung ke halaman berikut',
    'TANGGAL KETERANGAN CBG MUTASI SALDO',
}
_SKIP_STARTS = (
    'REKENING', 'KCP ', 'JAYSON', 'MEDAN ', 'RT000', 'COMP.',
    'CATATAN', 'Apabila', 'telah ', 'BCA berhak', 'SALDO AWAL :',
    'MUTASI CR', 'MUTASI DB', 'SALDO AKHIR', 'INDONESIA', 'Rekening', 'Laporan',
    'NO. REKENING', 'HALAMAN',
)


def _parse_num(s: str) -> float:
    return float(s.replace(',', ''))


def _open_pdf(pdf_bytes: bytes, password: Optional[str]) -> io.BytesIO:
    """
    Return a BytesIO of the (decrypted) PDF.
    If password is provided, decrypt with pikepdf first.
    If the PDF is not encrypted (or password is None/empty), pass through directly.
    """
    buf = io.BytesIO(pdf_bytes)

    if not password:
        return buf

    # Try decrypting with pikepdf — if password is wrong it raises pikepdf.PasswordError
    try:
        with pikepdf.open(io.BytesIO(pdf_bytes), password=password) as pdf:
            out = io.BytesIO()
            pdf.save(out)
            out.seek(0)
            return out
    except pikepdf.PasswordError:
        raise ValueError("Incorrect PDF password.")
    except Exception:
        # PDF may not actually be encrypted — return original bytes
        return buf


def extract_transactions(pdf_bytes: bytes, password: Optional[str] = None) -> list[Transaction]:
    """
    Decrypt (if needed) and extract transactions from a BCA e-statement PDF.
    Returns a list of Transaction objects.
    Raises ValueError if password is wrong or no transactions found.
    """
    stream = _open_pdf(pdf_bytes, password)

    with pdfplumber.open(stream) as plumber_pdf:
        # Extract year from page 1 header
        first_page_text = plumber_pdf.pages[0].extract_text() or ''
        m = _PERIOD_RE.search(first_page_text)
        if not m:
            raise ValueError("Could not determine statement period from PDF.")
        year = int(m.group(2))

        # Collect all non-header/footer lines from all pages
        all_lines: list[str] = []
        for page in plumber_pdf.pages:
            raw = page.extract_text() or ''
            for line in raw.splitlines():
                line = line.strip()
                if not line:
                    continue
                if line in _SKIP_EXACT:
                    continue
                if any(line.startswith(s) for s in _SKIP_STARTS):
                    continue
                all_lines.append(line)

    # Group lines into transaction blocks (each starts with DD/MM)
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in all_lines:
        if _TX_START.match(line):
            if current:
                blocks.append(current)
            current = [line]
        elif current:
            current.append(line)
    if current:
        blocks.append(current)

    transactions: list[Transaction] = []
    for block in blocks:
        first = block[0]

        # Skip opening balance line
        if 'SALDO AWAL' in first:
            continue

        # Parse date
        date_str = first[:5]   # DD/MM
        day, mon = map(int, date_str.split('/'))
        tx_date = date(year, mon, day)

        # Find amounts on the first line
        amounts = _AMOUNT_RE.findall(first)
        if not amounts:
            continue

        is_debit = bool(re.search(r'\bDB\b', first))
        amount  = _parse_num(amounts[0])
        balance = _parse_num(amounts[1]) if len(amounts) > 1 else None

        if is_debit:
            amount = -amount

        # Description = text between date prefix and first amount
        desc_end = first.index(amounts[0])
        desc = first[6:desc_end].strip()

        # Enrich description with merchant name from continuation lines
        for cont in block[1:]:
            match = _MERCHANT_RE.search(cont)
            if match:
                merchant = match.group(1).strip()
                if merchant:
                    desc = f'{desc} | {merchant}'
                break

        transactions.append(Transaction(
            transaction_date=tx_date,
            description=desc,
            amount=amount,
            balance=balance,
        ))

    if not transactions:
        raise ValueError("No transactions found. Check PDF format or password.")

    return transactions
