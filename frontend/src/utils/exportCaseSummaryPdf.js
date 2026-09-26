import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function clean(
  value,
  fallback = "Not provided"
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  return String(value).trim();
}

function formatDate(value) {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function safeFileName(value) {
  return String(value)
    .replace(
      /[^a-z0-9]+/gi,
      "-"
    )
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function exportCaseSummaryPdf({
  matter,
  evidence = [],
  timeline = [],
  legalMatches = [],
  referrals = [],
}) {
  if (!matter) {
    throw new Error(
      "Matter information is required."
    );
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth =
    doc.internal.pageSize.getWidth();

  const pageHeight =
    doc.internal.pageSize.getHeight();

  const margin = 18;

  const contentWidth =
    pageWidth - margin * 2;

  let y = 20;

  function checkPage(
    requiredHeight = 20
  ) {
    if (
      y + requiredHeight >
      pageHeight - 22
    ) {
      doc.addPage();
      y = 22;
    }
  }

  function addSectionTitle(
    title
  ) {
    checkPage(18);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.setFontSize(9);

    doc.setTextColor(
      53,
      109,
      104
    );

    doc.text(
      title.toUpperCase(),
      margin,
      y
    );

    y += 7;
  }

  function addParagraph(
    text,
    options = {}
  ) {
    const {
      size = 10,
      bold = false,
      colour = [
        49,
        73,
        73,
      ],
      spacing = 5,
    } = options;

    doc.setFont(
      "helvetica",
      bold
        ? "bold"
        : "normal"
    );

    doc.setFontSize(size);

    doc.setTextColor(
      colour[0],
      colour[1],
      colour[2]
    );

    const lines =
      doc.splitTextToSize(
        clean(text),
        contentWidth
      );

    const estimatedHeight =
      lines.length *
        (size * 0.42) +
      spacing;

    checkPage(
      estimatedHeight
    );

    doc.text(
      lines,
      margin,
      y
    );

    y += estimatedHeight;
  }

  function addFooter() {
    const totalPages =
      doc.getNumberOfPages();

    for (
      let page = 1;
      page <= totalPages;
      page += 1
    ) {
      doc.setPage(page);

      doc.setDrawColor(
        220,
        226,
        222
      );

      doc.line(
        margin,
        pageHeight - 15,
        pageWidth - margin,
        pageHeight - 15
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(7.5);

      doc.setTextColor(
        110,
        125,
        122
      );

      doc.text(
        "Verdict Matter Pack",
        margin,
        pageHeight - 9
      );

      doc.text(
        `Page ${page} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 9,
        {
          align: "right",
        }
      );
    }
  }

  /*
   * Header
   */

  doc.setFillColor(
    11,
    46,
    52
  );

  doc.roundedRect(
    margin,
    y,
    13,
    13,
    6.5,
    6.5,
    "F"
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(10);

  doc.setTextColor(
    255,
    255,
    255
  );

  doc.text(
    "V",
    margin + 6.5,
    y + 8.5,
    {
      align: "center",
    }
  );

  doc.setTextColor(
    11,
    46,
    52
  );

  doc.setFontSize(16);

  doc.text(
    "VERDICT",
    margin + 18,
    y + 6
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(8.5);

  doc.setTextColor(
    108,
    124,
    121
  );

  doc.text(
    "Matter preparation pack",
    margin + 18,
    y + 11
  );

  y += 25;

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(22);

  doc.setTextColor(
    11,
    46,
    52
  );

  doc.text(
    "Matter Pack",
    margin,
    y
  );

  y += 7;

  addParagraph(
    "A structured preparation pack combining your account, matter details, timeline, evidence index, verified legal context and support routes.",
    {
      size: 9.5,
      colour: [
        103,
        119,
        116,
      ],
      spacing: 9,
    }
  );

  addParagraph(
    `Prepared ${new Intl.DateTimeFormat(
      "en-ZA",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    ).format(new Date())}`,
    {
      size: 8.5,
      colour: [
        108,
        124,
        121,
      ],
      spacing: 9,
    }
  );

  /*
   * Important separation
   */

  addSectionTitle(
    "How to read this pack"
  );

  addParagraph(
    "Your account, timeline and evidence descriptions are information recorded by you in Verdict. The verified legal context and referral sections come from Verdict's verified legal information service. Inclusion in this pack does not prove any fact or legal claim.",
    {
      size: 9,
      spacing: 11,
    }
  );

  /*
   * Matter details
   */

  addSectionTitle(
    "Matter details"
  );

  autoTable(doc, {
    startY: y,

    margin: {
      left: margin,
      right: margin,
    },

    tableWidth:
      contentWidth,

    body: [
      [
        "Incident date",
        matter.unsure_date
          ? "Date uncertain"
          : formatDate(
              matter.incident_date
            ),
      ],

      [
        "Other party",
        clean(
          matter.involved_name ||
            matter.involved_type
        ),
      ],

      [
        "Status",
        matter.status ===
        "closed"
          ? "Closed"
          : "In progress",
      ],
    ],

    theme: "plain",

    styles: {
      font: "helvetica",
      fontSize: 9,

      cellPadding: {
        top: 3.5,
        bottom: 3.5,
        left: 3,
        right: 3,
      },

      textColor: [
        43,
        69,
        69,
      ],

      lineColor: [
        224,
        230,
        226,
      ],

      lineWidth: {
        bottom: 0.15,
      },
    },

    columnStyles: {
      0: {
        cellWidth: 42,
        fontStyle: "bold",

        textColor: [
          92,
          111,
          108,
        ],
      },
    },
  });

  y =
    doc.lastAutoTable.finalY +
    12;

  /*
   * Story
   */

  addSectionTitle(
    "What happened"
  );

  addParagraph(
    matter.story ||
      "No description was provided.",
    {
      size: 10,
      spacing: 12,
    }
  );

  /*
   * Timeline
   */

  addSectionTitle(
    `Timeline · ${timeline.length} ${
      timeline.length === 1
        ? "event"
        : "events"
    }`
  );

  if (
    timeline.length === 0
  ) {
    addParagraph(
      "No timeline events have been added.",
      {
        size: 9,

        colour: [
          120,
          135,
          132,
        ],

        spacing: 11,
      }
    );
  } else {
    autoTable(doc, {
      startY: y,

      margin: {
        left: margin,
        right: margin,
      },

      head: [
        [
          "Date",
          "Event",
          "Details",
        ],
      ],

      body:
        timeline.map(
          (event) => [
            formatDate(
              event.event_date
            ),

            clean(
              event.title,
              "Timeline event"
            ),

            clean(
              event.description,
              "—"
            ),
          ]
        ),

      theme: "grid",

      headStyles: {
        fillColor: [
          232,
          239,
          235,
        ],

        textColor: [
          27,
          67,
          68,
        ],

        fontStyle:
          "bold",
      },

      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 3,

        textColor: [
          55,
          78,
          77,
        ],

        lineColor: [
          224,
          230,
          226,
        ],

        lineWidth: 0.15,

        overflow:
          "linebreak",

        valign: "top",
      },

      columnStyles: {
        0: {
          cellWidth: 32,
        },

        1: {
          cellWidth: 43,
        },
      },

      rowPageBreak:
        "avoid",
    });

    y =
      doc.lastAutoTable
        .finalY +
      12;
  }

  /*
   * Evidence
   */

  checkPage(25);

  addSectionTitle(
    `Evidence · ${evidence.length} ${
      evidence.length === 1
        ? "item"
        : "items"
    }`
  );

  if (
    evidence.length === 0
  ) {
    addParagraph(
      "No evidence has been added.",
      {
        size: 9,

        colour: [
          120,
          135,
          132,
        ],

        spacing: 11,
      }
    );
  } else {
    autoTable(doc, {
      startY: y,

      margin: {
        left: margin,
        right: margin,
      },

      head: [
        [
          "#",
          "Evidence",
          "Type",
          "Description",
        ],
      ],

      body:
        evidence.map(
          (
            item,
            index
          ) => [
            String(
              index + 1
            ),

            clean(
              item.file_name ||
                item.title,
              `Evidence item ${
                index + 1
              }`
            ),

            clean(
              item.evidence_type,
              "Uncategorised"
            ),

            clean(
              item.description,
              "—"
            ),
          ]
        ),

      theme: "grid",

      headStyles: {
        fillColor: [
          232,
          239,
          235,
        ],

        textColor: [
          27,
          67,
          68,
        ],

        fontStyle:
          "bold",
      },

      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 3,

        textColor: [
          55,
          78,
          77,
        ],

        lineColor: [
          224,
          230,
          226,
        ],

        lineWidth: 0.15,

        overflow:
          "linebreak",

        valign: "top",
      },

      columnStyles: {
        0: {
          cellWidth: 10,
          halign:
            "center",
        },

        1: {
          cellWidth: 48,
        },

        2: {
          cellWidth: 34,
        },
      },

      rowPageBreak:
        "avoid",
    });

    y =
      doc.lastAutoTable
        .finalY +
      12;
  }

  /*
   * Verified legal context
   */

  checkPage(25);

  addSectionTitle(
    `Verified legal context · ${legalMatches.length} ${
      legalMatches.length === 1
        ? "area"
        : "areas"
    }`
  );

  if (
    legalMatches.length === 0
  ) {
    addParagraph(
      "No verified legal area has been matched to this matter yet.",
      {
        size: 9,

        colour: [
          120,
          135,
          132,
        ],

        spacing: 11,
      }
    );
  } else {
    autoTable(doc, {
      startY: y,

      margin: {
        left: margin,
        right: margin,
      },

      head: [
        [
          "#",
          "Legal area",
          "Context",
        ],
      ],

      body:
        legalMatches.map(
          (
            match,
            index
          ) => {
            const legalArea =
              match.topic?.name ||
              match.topic?.title ||
              match.issue?.name ||
              match.domain?.name ||
              "Relevant legal area";

            const context =
              [
                match.domain?.name,
                match.issue?.name,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " • "
                );

            return [
              String(
                index + 1
              ),

              clean(
                legalArea,
                "Relevant legal area"
              ),

              clean(
                context,
                "Verified by Verdict's legal information service"
              ),
            ];
          }
        ),

      theme: "grid",

      headStyles: {
        fillColor: [
          232,
          239,
          235,
        ],

        textColor: [
          27,
          67,
          68,
        ],

        fontStyle:
          "bold",
      },

      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 3,

        textColor: [
          55,
          78,
          77,
        ],

        lineColor: [
          224,
          230,
          226,
        ],

        lineWidth: 0.15,

        overflow:
          "linebreak",

        valign: "top",
      },

      columnStyles: {
        0: {
          cellWidth: 10,
          halign:
            "center",
        },

        1: {
          cellWidth: 60,
        },
      },

      rowPageBreak:
        "avoid",
    });

    y =
      doc.lastAutoTable
        .finalY +
      12;
  }

  /*
   * Verified official sources
   */

  const officialSources =
    legalMatches
      .flatMap((match) =>
        Array.isArray(match.sources)
          ? match.sources
          : []
      )
      .filter(Boolean)
      .filter(
        (source, index, all) => {
          const key =
            source.id ||
            source.url ||
            source.official_url ||
            source.title ||
            source.name;

          return (
            index ===
            all.findIndex(
              (item) =>
                (
                  item.id ||
                  item.url ||
                  item.official_url ||
                  item.title ||
                  item.name
                ) === key
            )
          );
        }
      );

  checkPage(25);

  addSectionTitle(
    `Verified sources · ${officialSources.length} ${
      officialSources.length === 1
        ? "source"
        : "sources"
    }`
  );

  if (officialSources.length === 0) {
    addParagraph(
      "No separate verified source links are available in this pack.",
      {
        size: 9,
        colour: [
          120,
          135,
          132,
        ],
        spacing: 11,
      }
    );
  } else {
    autoTable(doc, {
      startY: y,
      margin: {
        left: margin,
        right: margin,
      },
      head: [
        [
          "Source",
          "Official reference",
        ],
      ],
      body:
        officialSources.map(
          (source) => [
            clean(
              source.title ||
                source.name ||
                source.source_name,
              "Verified source"
            ),
            clean(
              source.official_url ||
                source.url ||
                source.website_url,
              "Available in Verdict"
            ),
          ]
        ),
      theme: "grid",
      headStyles: {
        fillColor: [
          232,
          239,
          235,
        ],
        textColor: [
          27,
          67,
          68,
        ],
        fontStyle: "bold",
      },
      styles: {
        font: "helvetica",
        fontSize: 8.3,
        cellPadding: 3,
        textColor: [
          55,
          78,
          77,
        ],
        lineColor: [
          224,
          230,
          226,
        ],
        lineWidth: 0.15,
        overflow: "linebreak",
        valign: "top",
      },
      columnStyles: {
        0: {
          cellWidth: 70,
        },
      },
      rowPageBreak: "avoid",
    });

    y =
      doc.lastAutoTable.finalY +
      12;
  }

  /*
   * Verified referrals
   */

  checkPage(25);

  addSectionTitle(
    `Where to get help · ${referrals.length} ${
      referrals.length === 1
        ? "referral"
        : "referrals"
    }`
  );

  if (
    referrals.length === 0
  ) {
    addParagraph(
      "No verified referral has been added to this summary yet.",
      {
        size: 9,

        colour: [
          120,
          135,
          132,
        ],

        spacing: 11,
      }
    );
  } else {
    autoTable(doc, {
      startY: y,

      margin: {
        left: margin,
        right: margin,
      },

      head: [
        [
          "Legal area",
          "Organisation",
          "How they may help",
        ],
      ],

      body:
        referrals.map(
          (
            referral
          ) => {
            const organisation =
              referral.organisation ||
              referral.referral_organisation ||
              referral.organisation_details ||
              {};

            const name =
              organisation.name ||
              referral.organisation_name ||
              referral.title ||
              "Support organisation";

            const details =
              [
                referral.instructions,
                referral.eligibility_notes,
                referral.urgency_note,
              ]
                .filter(
                  Boolean
                )
                .join(
                  "\n"
                );

            return [
              clean(
                referral.legalArea,
                "Relevant legal area"
              ),

              clean(
                name,
                "Support organisation"
              ),

              clean(
                details,
                "See the official referral information in Verdict."
              ),
            ];
          }
        ),

      theme: "grid",

      headStyles: {
        fillColor: [
          232,
          239,
          235,
        ],

        textColor: [
          27,
          67,
          68,
        ],

        fontStyle:
          "bold",
      },

      styles: {
        font: "helvetica",
        fontSize: 8.3,
        cellPadding: 3,

        textColor: [
          55,
          78,
          77,
        ],

        lineColor: [
          224,
          230,
          226,
        ],

        lineWidth: 0.15,

        overflow:
          "linebreak",

        valign: "top",
      },

      columnStyles: {
        0: {
          cellWidth: 45,
        },

        1: {
          cellWidth: 50,
        },
      },

      rowPageBreak:
        "avoid",
    });

    y =
      doc.lastAutoTable
        .finalY +
      12;
  }

  /*
   * Disclaimer
   */

  checkPage(35);

  doc.setFillColor(
    240,
    244,
    240
  );

  const disclaimer =
    "This Matter Pack organises information recorded in Verdict for preparation and review. Your account, timeline and evidence descriptions remain user-provided information and are not verified as facts by Verdict. Verified legal context and referrals are presented separately. This pack does not determine liability, guilt, entitlement, the strength of a matter or its likely outcome, does not prove a claim, and does not replace advice from a qualified legal professional.";

  const disclaimerLines =
    doc.splitTextToSize(
      disclaimer,
      contentWidth - 12
    );

  const boxHeight =
    disclaimerLines.length *
      4.2 +
    17;

  doc.roundedRect(
    margin,
    y,
    contentWidth,
    boxHeight,
    3,
    3,
    "F"
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(8.5);

  doc.setTextColor(
    49,
    83,
    81
  );

  doc.text(
    "ABOUT THIS MATTER PACK",
    margin + 6,
    y + 7
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(8);

  doc.setTextColor(
    93,
    112,
    108
  );

  doc.text(
    disclaimerLines,
    margin + 6,
    y + 13
  );

  addFooter();

  const identifier =
    safeFileName(
      matter.involved_name ||
        matter.involved_type ||
        "matter"
    );

  doc.save(
    `verdict-matter-pack-${identifier}.pdf`
  );
}