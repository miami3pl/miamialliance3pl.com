#!/usr/bin/env python3
"""
Miami Alliance 3PL - Pro Forma Invoice Generator (Storage Services Only)
Generates a professional PDF invoice for storage and receiving services.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.pdfgen import canvas
from datetime import datetime, timedelta
import random

# Colors
NAVY_BLUE = HexColor('#1e3a5f')
TEAL_ACCENT = HexColor('#14b8a6')
ORANGE_ACCENT = HexColor('#f59e0b')
LIGHT_GRAY = HexColor('#f3f4f6')
YELLOW_BG = HexColor('#fef3c7')

# Generate random 4-digit invoice number
INVOICE_NUM = f"MA3PL-PF-20260212-{random.randint(1000, 9999)}"

# Invoice details
ISSUE_DATE = "February 12, 2026"
VALID_THROUGH = "March 14, 2026"

def create_invoice():
    """Generate the pro forma invoice PDF."""
    
    output_path = "/Users/yuri/Downloads/MiamiAlliance3PL_ProForma_GlobalCellutions_StorageOnly.pdf"
    
    # Create PDF
    pdf = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Styles
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=white,
        alignment=TA_LEFT,
        spaceAfter=0
    )
    
    tagline_style = ParagraphStyle(
        'Tagline',
        parent=styles['Normal'],
        fontSize=10,
        textColor=white,
        alignment=TA_LEFT
    )
    
    badge_style = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontSize=12,
        textColor=white,
        alignment=TA_CENTER,
        spaceAfter=10
    )
    
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        textColor=black
    )
    
    small_style = ParagraphStyle(
        'Small',
        parent=styles['Normal'],
        fontSize=8,
        textColor=black
    )
    
    # Header with navy background
    header_data = [
        [
            Paragraph('<b>MIAMI ALLIANCE 3PL</b>', title_style),
            ''
        ],
        [
            Paragraph('WAREHOUSING | FULFILLMENT | LOGISTICS', tagline_style),
            ''
        ]
    ]
    
    header_table = Table(header_data, colWidths=[5*inch, 2.5*inch])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), NAVY_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, -1), white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    
    elements.append(header_table)
    elements.append(Spacer(1, 0.1*inch))
    
    # PRO FORMA INVOICE badge
    badge_data = [[Paragraph('<b>PRO FORMA INVOICE</b>', badge_style)]]
    badge_table = Table(badge_data, colWidths=[7.5*inch])
    badge_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), TEAL_ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, -1), white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    elements.append(badge_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Invoice info and addresses
    info_data = [
        [
            Paragraph(f'<b>Invoice #:</b> {INVOICE_NUM}', normal_style),
            Paragraph('<b>Bill To:</b>', normal_style)
        ],
        [
            Paragraph(f'<b>Date:</b> {ISSUE_DATE}', normal_style),
            Paragraph('<b>Global Cellutions</b>', normal_style)
        ],
        [
            Paragraph(f'<b>Valid Through:</b> {VALID_THROUGH}', normal_style),
            Paragraph('Product: Arcade 1 Up - Mortal Kombat II', normal_style)
        ],
        [
            '',
            Paragraph('Pallets: 60 | Container Unload', normal_style)
        ],
        [
            Paragraph('<br/><b>From:</b>', normal_style),
            ''
        ],
        [
            Paragraph('<b>Miami Alliance 3PL</b>', normal_style),
            ''
        ],
        [
            Paragraph('8780 NW 100th ST', normal_style),
            ''
        ],
        [
            Paragraph('Medley, FL 33178', normal_style),
            ''
        ]
    ]
    
    info_table = Table(info_data, colWidths=[3.75*inch, 3.75*inch])
    info_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    elements.append(info_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Services section header
    section_header = Paragraph('<b>STORAGE &amp; RECEIVING SERVICES</b>', 
                               ParagraphStyle('SectionHeader', 
                                            parent=styles['Heading2'],
                                            fontSize=12,
                                            textColor=NAVY_BLUE,
                                            borderColor=TEAL_ACCENT,
                                            borderWidth=2,
                                            borderPadding=5,
                                            spaceAfter=10))
    elements.append(section_header)
    elements.append(Spacer(1, 0.1*inch))
    
    # Services table
    services_data = [
        ['Service', 'Qty', 'Rate', 'Frequency', 'Amount'],
        ['Pallet Storage\n(60 pallets x 30 days)', '60', '$0.75/pallet/day', 'Monthly', '$1,350.00'],
        ['Container Receiving &amp; Unload', '1', '$350.00', 'One-time', '$350.00']
    ]
    
    services_table = Table(services_data, colWidths=[2.5*inch, 0.6*inch, 1.2*inch, 1*inch, 1*inch])
    services_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
        ('TEXTCOLOR', (0, 1), (-1, -1), black),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ('ALIGN', (-1, 1), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#e5e7eb')),
    ]))
    
    elements.append(services_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Summary box (right aligned)
    summary_data = [
        ['<b>SUMMARY</b>', ''],
        ['Monthly Storage (60 pallets):', '$1,350.00'],
        ['One-time Receiving:', '$350.00'],
        ['<b>FIRST MONTH TOTAL:</b>', '<b>$1,700.00</b>'],
        ['', ''],
        ['<b>Ongoing Monthly:</b>', ''],
        ['Storage (60 pallets/day):', '$1,350.00/mo'],
        ['Daily rate:', '$45.00/day']
    ]
    
    # Convert to Paragraphs for better formatting
    summary_table_data = []
    for row in summary_data:
        summary_table_data.append([
            Paragraph(row[0], normal_style),
            Paragraph(row[1], ParagraphStyle('RightAlign', parent=normal_style, alignment=TA_RIGHT))
        ])
    
    summary_table = Table(summary_table_data, colWidths=[2.5*inch, 1.2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), NAVY_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), LIGHT_GRAY),
        ('ALIGN', (0, 1), (0, -1), 'LEFT'),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LINEABOVE', (0, 3), (-1, 3), 1.5, NAVY_BLUE),
        ('LINEBELOW', (0, 3), (-1, 3), 1.5, NAVY_BLUE),
        ('LINEABOVE', (0, 5), (-1, 5), 1, HexColor('#9ca3af')),
    ]))
    
    # Create a table to position summary on right
    positioning_data = [['', summary_table]]
    positioning_table = Table(positioning_data, colWidths=[4*inch, 3.7*inch])
    positioning_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    elements.append(positioning_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # KEY TERMS box
    terms_title = Paragraph('<b>KEY TERMS</b>', 
                           ParagraphStyle('TermsTitle', 
                                        parent=styles['Heading3'],
                                        fontSize=11,
                                        textColor=NAVY_BLUE,
                                        spaceAfter=5))
    
    terms_text = """
    • Storage: $0.75/pallet/day (60 pallets)<br/>
    • Container receiving: $350 flat fee (one-time)<br/>
    • Billing: Storage billed monthly<br/>
    • Minimum commitment: None
    """
    
    terms_para = Paragraph(terms_text, small_style)
    
    terms_data = [[terms_title], [terms_para]]
    terms_table = Table(terms_data, colWidths=[7.5*inch])
    terms_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), YELLOW_BG),
        ('BOX', (0, 0), (-1, -1), 1, HexColor('#d97706')),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    
    elements.append(terms_table)
    elements.append(Spacer(1, 0.15*inch))
    
    # IMPORTANT NOTES box
    notes_title = Paragraph('<b>IMPORTANT NOTES</b>', 
                           ParagraphStyle('NotesTitle', 
                                        parent=styles['Heading3'],
                                        fontSize=11,
                                        textColor=NAVY_BLUE,
                                        spaceAfter=5))
    
    notes_text = """
    • This pro forma invoice is an estimate. Final billing is based on actual services rendered.<br/>
    • Storage billed at $0.75/pallet/day ongoing. No intake or wrapping fees included.<br/>
    • All prices are in USD. Payment terms: Net 15. This quote is valid for 30 days from issue date.
    """
    
    notes_para = Paragraph(notes_text, small_style)
    
    notes_data = [[notes_title], [notes_para]]
    notes_table = Table(notes_data, colWidths=[7.5*inch])
    notes_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), YELLOW_BG),
        ('BOX', (0, 0), (-1, -1), 1, HexColor('#d97706')),
        ('LEFTPADDING', (0, 0), (-1, -1), 15),
        ('RIGHTPADDING', (0, 0), (-1, -1), 15),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    
    elements.append(notes_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Footer
    footer_text = """
    <b>Miami Alliance 3PL</b> | 8780 NW 100th ST, Medley, FL 33178<br/>
    contact@miamialliance3pl.com | www.miamialliance3pl.com
    """
    
    footer_para = Paragraph(footer_text, 
                           ParagraphStyle('Footer', 
                                        parent=small_style,
                                        alignment=TA_CENTER,
                                        textColor=HexColor('#6b7280')))
    
    footer_data = [[footer_para]]
    footer_table = Table(footer_data, colWidths=[7.5*inch])
    footer_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('LINEABOVE', (0, 0), (-1, 0), 1, HexColor('#e5e7eb')),
    ]))
    
    elements.append(footer_table)
    
    # Build PDF
    pdf.build(elements)
    
    return output_path, INVOICE_NUM

if __name__ == "__main__":
    output_path, invoice_num = create_invoice()
    print(f"✓ Invoice generated successfully!")
    print(f"  Invoice #: {invoice_num}")
    print(f"  Location: {output_path}")
    print(f"\nFirst month total: $1,700.00")
    print(f"Ongoing monthly: $1,350.00")
