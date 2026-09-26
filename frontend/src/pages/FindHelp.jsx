import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  supabase,
} from "../lib/supabaseClient";

import "../styles/findHelp.css";


const HELP_TYPES = [
  {
    id: "legal-aid",
    title: "Legal Aid",
    description:
      "Free or subsidised legal assistance for people who meet the relevant requirements.",
    tag: "Free or subsidised",
    icon: "L",
  },
  
  {
    id: "government",
    title: "Government Services",
    description:
      "Departments, public bodies and official services relevant to your matter.",
    tag: "Government",
    icon: "G",
  },
  {
    id: "tribunals",
    title: "Courts & Tribunals",
    description:
      "Official dispute-resolution bodies, courts and specialised tribunals.",
    tag: "Official",
    icon: "T",
  },
  {
    id: "private",
    title: "Legal Professionals",
    description:
      "Private attorneys and other qualified legal professionals who may assist with your matter.",
    tag: "Paid services",
    icon: "P",
  },
];


const FILTERS = [
  "All",
  "Free",
  "Government",
  "Professional",
];


const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const PROVINCE_ALIASES = {
  "eastern cape": "Eastern Cape",
  "free state": "Free State",
  gauteng: "Gauteng",
  "kwazulu natal": "KwaZulu-Natal",
  "kwazulu-natal": "KwaZulu-Natal",
  limpopo: "Limpopo",
  mpumalanga: "Mpumalanga",
  "north west": "North West",
  "north-west": "North West",
  "northern cape": "Northern Cape",
  "western cape": "Western Cape",
};

function normaliseProvince(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return PROVINCE_ALIASES[key] || "";
}

function organisationSearchText(organisation) {
  const services = Array.isArray(
    organisation?.services
  )
    ? organisation.services.join(" ")
    : organisation?.services || "";

  return [
    organisation?.name,
    organisation?.organisation_type,
    organisation?.description,
    organisation?.coverage_area,
    organisation?.province,
    organisation?.eligibility_notes,
    services,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function organisationMatchesHelpType(
  organisation,
  helpTypeId
) {
  if (!helpTypeId) {
    return true;
  }

  const text =
    organisationSearchText(
      organisation
    );

  if (helpTypeId === "legal-aid") {
    return (
      text.includes("legal aid") ||
      text.includes("pro bono") ||
      text.includes("free legal") ||
      text.includes("subsid")
    );
  }

  if (helpTypeId === "community") {
    return (
      text.includes("community") ||
      text.includes("advice office") ||
      text.includes("ngo") ||
      text.includes("non-profit") ||
      text.includes("nonprofit")
    );
  }

  if (helpTypeId === "government") {
    return (
      text.includes("government") ||
      text.includes("department") ||
      text.includes("public body") ||
      text.includes("public service")
    );
  }

  if (helpTypeId === "tribunals") {
    return (
      text.includes("tribunal") ||
      text.includes("court") ||
      text.includes("commission") ||
      text.includes("ombud")
    );
  }

  if (helpTypeId === "private") {
    return (
      text.includes("attorney") ||
      text.includes("law firm") ||
      text.includes("legal professional") ||
      text.includes("private")
    );
  }

  return true;
}

function organisationMatchesFilter(
  organisation,
  filter
) {
  if (!filter || filter === "All") {
    return true;
  }

  const text =
    organisationSearchText(
      organisation
    );

  if (filter === "Free") {
    return (
      text.includes("free") ||
      text.includes("legal aid") ||
      text.includes("pro bono") ||
      text.includes("subsid")
    );
  }

  if (filter === "Government") {
    return (
      text.includes("government") ||
      text.includes("department") ||
      text.includes("tribunal") ||
      text.includes("commission") ||
      text.includes("public")
    );
  }

  if (filter === "Community") {
    return (
      text.includes("community") ||
      text.includes("ngo") ||
      text.includes("non-profit") ||
      text.includes("nonprofit") ||
      text.includes("advice office")
    );
  }

  if (filter === "Professional") {
    return (
      text.includes("attorney") ||
      text.includes("law firm") ||
      text.includes("legal professional") ||
      text.includes("private")
    );
  }

  return true;
}


function FindHelp() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [
    searchParams,
  ] = useSearchParams();

  const matterIdFromUrl =
    searchParams.get(
      "matterId"
    );

  const routeMatter =
    location.state?.matter ||
    null;


  const [
    matter,
    setMatter,
  ] = useState(
    routeMatter
  );

  const [
    referrals,
    setReferrals,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    activeFilter,
    setActiveFilter,
  ] = useState("All");

  const [
    loading,
    setLoading,
  ] = useState(
    Boolean(
      routeMatter?.id ||
      matterIdFromUrl
    )
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedProvince,
    setSelectedProvince,
  ] = useState("");

  const [
    provincialOffices,
    setProvincialOffices,
  ] = useState({});

  const [
    officeLoading,
    setOfficeLoading,
  ] = useState({});

  const [
    officeErrors,
    setOfficeErrors,
  ] = useState({});

  const [
    directoryOrganisations,
    setDirectoryOrganisations,
  ] = useState([]);

  const [
    directoryOffices,
    setDirectoryOffices,
  ] = useState([]);

  const [
    directoryLoading,
    setDirectoryLoading,
  ] = useState(false);

  const [
    directoryError,
    setDirectoryError,
  ] = useState("");

  const [
    selectedHelpType,
    setSelectedHelpType,
  ] = useState("");

  const [
    directoryProvince,
    setDirectoryProvince,
  ] = useState("");

  const [
    locating,
    setLocating,
  ] = useState(false);

  const [
    locationStatus,
    setLocationStatus,
  ] = useState("");

  const [
    userCoordinates,
    setUserCoordinates,
  ] = useState(null);


  useEffect(() => {
    let mounted = true;


    async function loadMatterReferrals() {
      const matterId =
        routeMatter?.id ||
        matterIdFromUrl;

      if (!matterId) {
        setLoading(false);
        return;
      }


      setLoading(true);
      setError("");


      try {
        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth
            .getUser();


        if (
          userError ||
          !user
        ) {
          throw new Error(
            "Your session could not be verified."
          );
        }


        const {
          data:
            freshMatter,
          error:
            matterError,
        } =
          await supabase
            .from("matters")
            .select(
              `
                id,
                story,
                incident_date,
                unsure_date,
                involved_type,
                involved_name,
                status
              `
            )
            .eq(
              "id",
              matterId
            )
            .eq(
              "user_id",
              user.id
            )
            .single();


        if (matterError) {
          throw matterError;
        }


        if (!freshMatter) {
          throw new Error(
            "Matter not found."
          );
        }


        const story =
          freshMatter.story
            ?.trim();


        if (!story) {
          throw new Error(
            "Add a description of what happened before requesting support."
          );
        }


        const {
          data: {
            session,
          },
          error:
            sessionError,
        } =
          await supabase.auth
            .getSession();


        if (
          sessionError ||
          !session?.access_token
        ) {
          throw new Error(
            "Your session could not be verified."
          );
        }


        const response =
          await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/legal/search`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body:
                JSON.stringify({
                  question:
                    story,
                }),
            }
          );


        const rawText =
          await response.text();

        let result = null;


        if (rawText) {
          try {
            result =
              JSON.parse(
                rawText
              );
          } catch {
            throw new Error(
              "Verdict received an invalid response from the legal service."
            );
          }
        }


        if (!response.ok) {
          throw new Error(
            result?.error ||
              result?.message ||
              "Verified referrals could not be loaded."
          );
        }


        const matches =
          Array.isArray(
            result?.matches
          )
            ? result.matches
            : [];


        const collectedReferrals =
          matches.flatMap(
            (
              match
            ) => {
              const matchReferrals =
                Array.isArray(
                  match?.referrals
                )
                  ? match.referrals
                  : [];


              return matchReferrals.map(
                (
                  referral
                ) => ({
                  ...referral,

                  legalArea:
                    match?.topic
                      ?.title ||
                    match?.topic
                      ?.name ||
                    match?.issue
                      ?.name ||
                    match?.domain
                      ?.name ||
                    "Legal support",
                })
              );
            }
          );


        if (!mounted) {
          return;
        }


        setMatter(
          freshMatter
        );

        setReferrals(
          collectedReferrals
        );
      } catch (
        loadError
      ) {
        console.error(
          "Unable to load verified referrals:",
          loadError
        );


        if (mounted) {
          setError(
            loadError.message ||
              "We couldn't load verified support options right now."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }


    loadMatterReferrals();


    return () => {
      mounted = false;
    };
  }, [
    routeMatter?.id,
    matterIdFromUrl,
  ]);



  useEffect(() => {
    let mounted = true;

    async function loadReferralDirectory() {
      if (matter) {
        return;
      }

      setDirectoryLoading(true);
      setDirectoryError("");

      try {
        const {
          data,
          error: directoryLoadError,
        } = await supabase
          .from(
            "referral_organisations"
          )
          .select(
            `
              id,
              name,
              organisation_type,
              description,
              website_url,
              phone,
              email,
              coverage_area,
              province,
              services,
              eligibility_notes,
              status,
              is_verified,
              last_verified_at
            `
          )
          .eq("status", "active")
          .eq("is_verified", true)
          .order("name", {
            ascending: true,
          });

        if (directoryLoadError) {
          throw directoryLoadError;
        }

        if (!mounted) {
          return;
        }

        setDirectoryOrganisations(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (loadError) {
        console.error(
          "Unable to load referral directory:",
          loadError
        );

        if (mounted) {
          setDirectoryError(
            loadError?.message ||
              "We couldn't load the verified referral directory right now."
          );
        }
      } finally {
        if (mounted) {
          setDirectoryLoading(false);
        }
      }
    }

    loadReferralDirectory();

    return () => {
      mounted = false;
    };
  }, [matter?.id]);

  useEffect(() => {
    let mounted = true;

    async function loadDirectoryOffices() {
      if (
        matter ||
        !directoryProvince
      ) {
        setDirectoryOffices([]);
        return;
      }

      try {
        const {
          data,
          error: officeDirectoryError,
        } = await supabase
          .from("referral_offices")
          .select(
            `
              id,
              organisation_id,
              office_name,
              province,
              coverage_area,
              address,
              phone,
              email,
              website_url,
              notes,
              status,
              is_verified,
              last_verified_at
            `
          )
          .eq(
            "province",
            directoryProvince
          )
          .eq("status", "active")
          .eq("is_verified", true);

        if (officeDirectoryError) {
          throw officeDirectoryError;
        }

        if (!mounted) {
          return;
        }

        setDirectoryOffices(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (loadError) {
        console.error(
          "Unable to load nearby referral offices:",
          loadError
        );

        if (mounted) {
          setDirectoryOffices([]);
        }
      }
    }

    loadDirectoryOffices();

    return () => {
      mounted = false;
    };
  }, [
    matter?.id,
    directoryProvince,
  ]);

  const availableDirectoryReferrals =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      const officeOrganisationIds =
        new Set(
          directoryOffices
            .map(
              (office) =>
                office.organisation_id
            )
            .filter(Boolean)
        );

      return directoryOrganisations
        .filter((organisation) => {
          const searchable =
            organisationSearchText(
              organisation
            );

          const matchesSearch =
            !query ||
            searchable.includes(query);

          const matchesFilter =
            organisationMatchesFilter(
              organisation,
              activeFilter
            );

          const matchesHelpType =
            organisationMatchesHelpType(
              organisation,
              selectedHelpType
            );

          return (
            matchesSearch &&
            matchesFilter &&
            matchesHelpType
          );
        })
        .sort((a, b) => {
          if (!directoryProvince) {
            return String(
              a.name || ""
            ).localeCompare(
              String(b.name || "")
            );
          }

          const aLocal =
            officeOrganisationIds.has(
              a.id
            ) ||
            normaliseProvince(
              a.province
            ) === directoryProvince;

          const bLocal =
            officeOrganisationIds.has(
              b.id
            ) ||
            normaliseProvince(
              b.province
            ) === directoryProvince;

          if (aLocal !== bLocal) {
            return aLocal ? -1 : 1;
          }

          return String(
            a.name || ""
          ).localeCompare(
            String(b.name || "")
          );
        });
    }, [
      directoryOrganisations,
      directoryOffices,
      directoryProvince,
      search,
      activeFilter,
      selectedHelpType,
    ]);

  async function resolveProvinceFromCoordinates(
    latitude,
    longitude
  ) {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        latitude
      )}&lon=${encodeURIComponent(
        longitude
      )}&zoom=5&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        "Province lookup failed."
      );
    }

    const result =
      await response.json();

    const candidates = [
      result?.address?.state,
      result?.address?.province,
      result?.address?.region,
    ];

    for (const candidate of candidates) {
      const province =
        normaliseProvince(candidate);

      if (province) {
        return province;
      }
    }

    return "";
  }

  function useCurrentLocation() {
    if (locating) {
      return;
    }

    setLocationStatus("");

    if (
      !("geolocation" in navigator)
    ) {
      setLocationStatus(
        "This browser does not support location access. Choose your province below instead."
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coordinates = {
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
        };

        setUserCoordinates(
          coordinates
        );

        try {
          const province =
            await resolveProvinceFromCoordinates(
              coordinates.latitude,
              coordinates.longitude
            );

          if (province) {
            setDirectoryProvince(
              province
            );
            setLocationStatus(
              `Location detected. Showing verified services for ${province} first.`
            );
          } else {
            setLocationStatus(
              "Location detected, but Verdict could not identify your province automatically. Choose your province below."
            );
          }
        } catch (
          locationLookupError
        ) {
          console.error(
            "Unable to identify province:",
            locationLookupError
          );

          setLocationStatus(
            "Location detected, but Verdict could not identify your province automatically. Choose your province below."
          );
        } finally {
          setLocating(false);
        }
      },
      (locationError) => {
        console.error(
          "Location permission or lookup failed:",
          locationError
        );

        const denied =
          locationError?.code === 1;

        setLocationStatus(
          denied
            ? "Location access was not allowed. Choose your province below instead."
            : "Verdict could not read your location. Choose your province below instead."
        );

        setLocating(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }

  function viewHelpType(
    helpTypeId
  ) {
    setSelectedHelpType(
      helpTypeId
    );

    window.requestAnimationFrame(
      () => {
        document
          .getElementById(
            "available-referrals"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }
    );
  }

  const uniqueReferrals =
    useMemo(() => {
      const seen =
        new Set();


      return referrals.filter(
        (
          referral,
          index
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
            `referral-${index}`;


          const key =
            name
              .trim()
              .toLowerCase();


          if (
            seen.has(key)
          ) {
            return false;
          }


          seen.add(key);

          return true;
        }
      );
    }, [referrals]);


  const filteredReferrals =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();


      if (!query) {
        return uniqueReferrals;
      }


      return uniqueReferrals.filter(
        (
          referral
        ) => {
          const organisation =
            referral.organisation ||
            referral.referral_organisation ||
            referral.organisation_details ||
            {};


          const searchableText = [
            organisation.name,
            referral.organisation_name,
            referral.title,
            referral.legalArea,
            referral.instructions,
            referral.description,
            organisation.description,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          return searchableText.includes(
            query
          );
        }
      );
    }, [
      search,
      uniqueReferrals,
    ]);


  const filteredTypes =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();


      return HELP_TYPES.filter(
        (
          item
        ) => {
          const matchesSearch =
            !query ||
            `${item.title} ${item.description} ${item.tag}`
              .toLowerCase()
              .includes(
                query
              );


          const matchesFilter =
            activeFilter ===
              "All" ||
            (
              activeFilter ===
                "Free" &&
              item.tag
                .toLowerCase()
                .includes(
                  "free"
                )
            ) ||
            (
              activeFilter ===
                "Government" &&
              item.id ===
                "government"
            ) ||
            
            (
              activeFilter ===
                "Professional" &&
              item.id ===
                "private"
            );


          return (
            matchesSearch &&
            matchesFilter
          );
        }
      );
    }, [
      search,
      activeFilter,
    ]);


  function getOrganisation(
    referral
  ) {
    return (
      referral.organisation ||
      referral.referral_organisation ||
      referral.organisation_details ||
      {}
    );
  }


  function getOrganisationName(
    referral
  ) {
    const organisation =
      getOrganisation(
        referral
      );

    return (
      organisation.name ||
      referral.organisation_name ||
      referral.title ||
      "Support organisation"
    );
  }


  function getOrganisationId(
    referral
  ) {
    const organisation =
      getOrganisation(
        referral
      );

    return (
      organisation.id ||
      referral.organisation_id ||
      null
    );
  }


  function isRentalHousingTribunal(
    referral
  ) {
    return (
      getOrganisationName(
        referral
      )
        .trim()
        .toLowerCase() ===
      "rental housing tribunal"
    );
  }


  async function loadProvincialOffice(
    referral,
    province
  ) {
    const organisationId =
      getOrganisationId(
        referral
      );

    if (
      !organisationId ||
      !province
    ) {
      return;
    }

    const key =
      organisationId;

    setOfficeLoading(
      (
        current
      ) => ({
        ...current,
        [key]: true,
      })
    );

    setOfficeErrors(
      (
        current
      ) => ({
        ...current,
        [key]: "",
      })
    );

    try {
      const {
        data,
        error:
          officeError,
      } =
        await supabase
          .from(
            "referral_offices"
          )
          .select(
            `
              id,
              organisation_id,
              office_name,
              province,
              coverage_area,
              address,
              phone,
              email,
              website_url,
              notes,
              status,
              is_verified,
              last_verified_at
            `
          )
          .eq(
            "organisation_id",
            organisationId
          )
          .eq(
            "province",
            province
          )
          .eq(
            "status",
            "active"
          )
          .eq(
            "is_verified",
            true
          )
          .maybeSingle();

      if (officeError) {
        throw officeError;
      }

      setProvincialOffices(
        (
          current
        ) => ({
          ...current,
          [key]:
            data || null,
        })
      );
    } catch (
      loadError
    ) {
      console.error(
        "Unable to load provincial office:",
        loadError
      );

      setOfficeErrors(
        (
          current
        ) => ({
          ...current,
          [key]:
            loadError.message ||
            "We couldn't load this provincial office right now.",
        })
      );
    } finally {
      setOfficeLoading(
        (
          current
        ) => ({
          ...current,
          [key]: false,
        })
      );
    }
  }


  function handleProvinceChange(
    referral,
    province
  ) {
    setSelectedProvince(
      province
    );

    const organisationId =
      getOrganisationId(
        referral
      );

    if (organisationId) {
      setProvincialOffices(
        (
          current
        ) => ({
          ...current,
          [organisationId]:
            undefined,
        })
      );
    }

    if (province) {
      loadProvincialOffice(
        referral,
        province
      );
    }
  }


  function goBack() {
    if (matter) {
      navigate(
        "/matters/new/guidance",
        {
          state: {
            matter,
          },
        }
      );

      return;
    }


    navigate(
      "/home"
    );
  }


  return (
    <main className="find-help-page">
      <section className="find-help-shell">

        <header className="find-help-header">
          <button
            type="button"
            className="find-help-back"
            onClick={
              goBack
            }
            aria-label="Go back"
          >
            ←
          </button>

          <span className="find-help-wordmark">
            VERDICT
          </span>

          <div className="find-help-header-space" />
        </header>


        <section className="find-help-title">
          <span className="find-help-eyebrow">
            Referrals & support
          </span>

          <h1>
            Find Help
          </h1>

          <p>
            Find organisations and
            professionals that may be
            able to help with your
            legal matter.
          </p>
        </section>


        <div className="find-help-search">
          <span>
            ⌕
          </span>

          <input
            type="search"
            value={
              search
            }
            onChange={
              (
                event
              ) =>
                setSearch(
                  event.target.value
                )
            }
            placeholder="Search for help"
          />

          {search && (
            <button
              type="button"
              onClick={
                () =>
                  setSearch("")
              }
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>


        {matter && (
          <section className="find-help-matter-context">
            <span>
              Support for this matter
            </span>

            <h2>
              Verdict is using your
              situation to find
              relevant help.
            </h2>

            <p>
              {matter.story}
            </p>
          </section>
        )}


        {loading && (
          <section className="find-help-referral-status">
            <div className="find-help-status-icon">
              V
            </div>

            <div>
              <span>
                Checking verified
                referrals
              </span>

              <h2>
                Finding relevant
                support
              </h2>

              <p>
                Verdict is checking
                the organisations and
                services connected to
                the legal information
                matched to your matter.
              </p>
            </div>
          </section>
        )}


        {!loading &&
          error && (
            <section className="find-help-referral-status">
              <div className="find-help-status-icon">
                !
              </div>

              <div>
                <span>
                  Support unavailable
                </span>

                <h2>
                  We couldn't load
                  verified referrals
                </h2>

                <p>
                  {error}
                </p>
              </div>
            </section>
          )}


        {!loading &&
          !error &&
          matter &&
          uniqueReferrals.length >
            0 && (
            <section className="find-help-section">

              <div className="find-help-section-heading">
                <span className="section-label">
                  Recommended for your
                  matter
                </span>

                <p>
                  Verified support
                  options connected to
                  the legal areas
                  Verdict identified.
                </p>
              </div>


              <div className="verified-referral-list">
                {filteredReferrals.map(
                  (
                    referral,
                    index
                  ) => {
                    const organisation =
                      getOrganisation(
                        referral
                      );

                    const name =
                      getOrganisationName(
                        referral
                      );

                    const organisationId =
                      getOrganisationId(
                        referral
                      );

                    const url =
                      referral.official_url ||
                      organisation.official_url ||
                      organisation.website_url ||
                      referral.url ||
                      organisation.website ||
                      null;

                    const phone =
                      referral.phone ||
                      organisation.phone ||
                      organisation.contact_number ||
                      null;

                    const email =
                      referral.email ||
                      organisation.email ||
                      null;

                    const description =
                      referral.instructions ||
                      referral.description ||
                      organisation.description ||
                      null;

                    const provincial =
                      isRentalHousingTribunal(
                        referral
                      );

                    const office =
                      organisationId
                        ? provincialOffices[
                            organisationId
                          ]
                        : null;

                    const loadingOffice =
                      organisationId
                        ? Boolean(
                            officeLoading[
                              organisationId
                            ]
                          )
                        : false;

                    const officeError =
                      organisationId
                        ? officeErrors[
                            organisationId
                          ]
                        : "";

                    return (
                      <article
                        className="verified-referral-card"
                        key={
                          referral.id ||
                          `${name}-${index}`
                        }
                      >
                        <div className="verified-referral-top">
                          <div className="verified-referral-icon">
                            {
                              String(
                                index +
                                  1
                              ).padStart(
                                2,
                                "0"
                              )
                            }
                          </div>

                          <div className="verified-referral-heading">
                            <span>
                              {
                                referral.legalArea
                              }
                            </span>

                            <h2>
                              {name}
                            </h2>
                          </div>
                        </div>

                        {description && (
                          <p className="verified-referral-description">
                            {description}
                          </p>
                        )}

                        {provincial && (
                          <div className="provincial-referral">
                            <div className="provincial-referral-heading">
                              <span>
                                Provincial service
                              </span>

                              <strong>
                                Choose the province
                                where the rental
                                property is located.
                              </strong>

                              <p>
                                Rental Housing
                                Tribunal services
                                are handled
                                provincially.
                              </p>
                            </div>

                            <label className="province-field">
                              <span>
                                Province
                              </span>

                              <select
                                value={
                                  selectedProvince
                                }
                                onChange={
                                  (
                                    event
                                  ) =>
                                    handleProvinceChange(
                                      referral,
                                      event.target.value
                                    )
                                }
                              >
                                <option value="">
                                  Select a province
                                </option>

                                {PROVINCES.map(
                                  (
                                    province
                                  ) => (
                                    <option
                                      key={
                                        province
                                      }
                                      value={
                                        province
                                      }
                                    >
                                      {
                                        province
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </label>

                            {loadingOffice && (
                              <div className="provincial-office-message">
                                Checking the
                                verified provincial
                                office...
                              </div>
                            )}

                            {!loadingOffice &&
                              officeError && (
                                <div className="provincial-office-message error">
                                  {
                                    officeError
                                  }
                                </div>
                              )}

                            {!loadingOffice &&
                              selectedProvince &&
                              !officeError &&
                              office ===
                                null && (
                                <div className="provincial-office-message">
                                  Verdict does not
                                  currently have a
                                  verified office
                                  for this province.
                                </div>
                              )}

                            {!loadingOffice &&
                              office && (
                                <article className="provincial-office-card">
                                  <span className="provincial-office-label">
                                    Verified office
                                  </span>

                                  <h3>
                                    {
                                      office.office_name
                                    }
                                  </h3>

                                  {office.address && (
                                    <div className="provincial-office-detail">
                                      <span>
                                        Address
                                      </span>

                                      <p>
                                        {
                                          office.address
                                        }
                                      </p>
                                    </div>
                                  )}

                                  {office.phone && (
                                    <div className="provincial-office-detail">
                                      <span>
                                        Phone
                                      </span>

                                      <a
                                        href={
                                          `tel:${office.phone}`
                                        }
                                      >
                                        {
                                          office.phone
                                        }
                                      </a>
                                    </div>
                                  )}

                                  {office.email && (
                                    <div className="provincial-office-detail">
                                      <span>
                                        Email
                                      </span>

                                      <a
                                        href={
                                          `mailto:${office.email}`
                                        }
                                      >
                                        {
                                          office.email
                                        }
                                      </a>
                                    </div>
                                  )}

                                  {office.notes && (
                                    <p className="provincial-office-notes">
                                      {
                                        office.notes
                                      }
                                    </p>
                                  )}

                                  {office.website_url && (
                                    <a
                                      className="provincial-office-action"
                                      href={
                                        office.website_url
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Visit provincial
                                      service

                                      <span>
                                        →
                                      </span>
                                    </a>
                                  )}
                                </article>
                              )}
                          </div>
                        )}

                        {!provincial &&
                          (phone ||
                            email) && (
                            <div className="verified-referral-contact">
                              {phone && (
                                <div>
                                  <span>
                                    Phone
                                  </span>

                                  <a
                                    href={
                                      `tel:${phone}`
                                    }
                                  >
                                    {phone}
                                  </a>
                                </div>
                              )}

                              {email && (
                                <div>
                                  <span>
                                    Email
                                  </span>

                                  <a
                                    href={
                                      `mailto:${email}`
                                    }
                                  >
                                    {email}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                        {!provincial &&
                          url && (
                            <a
                              className="verified-referral-action"
                              href={
                                url
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Visit official
                              service

                              <span>
                                →
                              </span>
                            </a>
                          )}
                      </article>
                    );
                  }
                )}
              </div>

              {filteredReferrals.length ===
                0 && (
                <div className="find-help-empty">
                  <h2>
                    No matching referral
                  </h2>

                  <p>
                    Try a different
                    search.
                  </p>
                </div>
              )}

            </section>
          )}


        {!loading &&
          !error &&
          matter &&
          uniqueReferrals.length ===
            0 && (
            <section className="find-help-no-referral">
              <span>
                Limited coverage
              </span>

              <h2>
                No verified referral
                found yet.
              </h2>

              <p>
                Verdict found legal
                information for your
                matter, but does not
                currently have a
                verified support
                organisation connected
                to it. Verdict will not
                invent a referral.
              </p>
            </section>
          )}


        {!matter && (
          <>
            <section className="find-help-location-card">
              <div className="location-icon">
                ◎
              </div>

              <div>
                <span>
                  Your location
                </span>

                <h2>
                  Find help near you
                </h2>

                <p>
                  Use your location to
                  prioritise verified
                  services for your
                  province. Verdict does
                  not send your
                  coordinates to the AI.
                </p>

                {locationStatus && (
                  <p className="find-help-location-status">
                    {locationStatus}
                  </p>
                )}

                <label className="find-help-province-field">
                  <span>
                    Province
                  </span>

                  <select
                    value={
                      directoryProvince
                    }
                    onChange={(
                      event
                    ) => {
                      setDirectoryProvince(
                        event.target.value
                      );

                      setLocationStatus(
                        event.target.value
                          ? `Showing verified services for ${event.target.value} first.`
                          : ""
                      );
                    }}
                  >
                    <option value="">
                      Choose province
                    </option>

                    {PROVINCES.map(
                      (province) => (
                        <option
                          key={
                            province
                          }
                          value={
                            province
                          }
                        >
                          {province}
                        </option>
                      )
                    )}
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={
                  useCurrentLocation
                }
                disabled={locating}
              >
                {locating
                  ? "Locating..."
                  : "Use my location"}
              </button>
            </section>


            <section className="find-help-section">
              <div className="find-help-section-heading">
                <span className="section-label">
                  Type of help
                </span>

                <p>
                  Choose the kind of
                  support you're
                  looking for.
                </p>
              </div>


              <div className="help-filter-row">
                {FILTERS.map(
                  (
                    filter
                  ) => (
                    <button
                      type="button"
                      key={
                        filter
                      }
                      className={
                        activeFilter ===
                        filter
                          ? "active"
                          : ""
                      }
                      onClick={
                        () =>
                          setActiveFilter(
                            filter
                          )
                      }
                    >
                      {filter}
                    </button>
                  )
                )}
              </div>


              {filteredTypes.length >
              0 ? (
                <div className="help-type-list">
                  {filteredTypes.map(
                    (
                      item
                    ) => (
                      <article
                        className="help-type-card"
                        key={
                          item.id
                        }
                      >

                        <div className="help-type-icon">
                          {
                            item.icon
                          }
                        </div>

                        <div className="help-type-copy">
                          <span>
                            {
                              item.tag
                            }
                          </span>

                          <h2>
                            {
                              item.title
                            }
                          </h2>

                          <p>
                            {
                              item.description
                            }
                          </p>

                          <button
                            type="button"
                            onClick={
                              () =>
                                viewHelpType(
                                  item.id
                                )
                            }
                          >
                            View referrals
                            <span>
                              →
                            </span>
                          </button>
                        </div>

                      </article>
                    )
                  )}
                </div>
              ) : (
                <div className="find-help-empty">
                  <h2>
                    No matching help
                    type
                  </h2>

                  <p>
                    Try a different
                    search or filter.
                  </p>
                </div>
              )}
            </section>


            <section
              className="find-help-section"
              id="available-referrals"
            >
              <div className="find-help-section-heading">
                <span className="section-label">
                  Available referrals
                </span>

                <p>
                  {directoryProvince
                    ? `Verified services for ${directoryProvince} are prioritised first.`
                    : "Browse Verdict's verified referral directory."}
                </p>
              </div>

              {selectedHelpType && (
                <div className="find-help-active-directory-filter">
                  <span>
                    Showing:{" "}
                    {HELP_TYPES.find(
                      (item) =>
                        item.id ===
                        selectedHelpType
                    )?.title ||
                      "Selected type"}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedHelpType(
                        ""
                      )
                    }
                  >
                    Show all
                  </button>
                </div>
              )}

              {directoryLoading ? (
                <div className="find-help-empty">
                  <h2>
                    Loading verified
                    referrals
                  </h2>

                  <p>
                    Verdict is checking
                    the referral
                    directory.
                  </p>
                </div>
              ) : directoryError ? (
                <div className="find-help-empty">
                  <h2>
                    Referrals unavailable
                  </h2>

                  <p>
                    {directoryError}
                  </p>
                </div>
              ) : availableDirectoryReferrals.length >
                0 ? (
                <div className="verified-referral-list">
                  {availableDirectoryReferrals.map(
                    (
                      organisation,
                      index
                    ) => {
                      const localOffice =
                        directoryOffices.find(
                          (office) =>
                            office.organisation_id ===
                            organisation.id
                        );

                      const website =
                        localOffice?.website_url ||
                        organisation.website_url ||
                        null;

                      const phone =
                        localOffice?.phone ||
                        organisation.phone ||
                        null;

                      const email =
                        localOffice?.email ||
                        organisation.email ||
                        null;

                      const local =
                        Boolean(
                          localOffice
                        ) ||
                        (
                          directoryProvince &&
                          normaliseProvince(
                            organisation.province
                          ) ===
                            directoryProvince
                        );

                      return (
                        <article
                          className="verified-referral-card"
                          key={
                            organisation.id ||
                            `${organisation.name}-${index}`
                          }
                        >
                          <div className="verified-referral-top">
                            <div className="verified-referral-icon">
                              {String(
                                index + 1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </div>

                            <div className="verified-referral-heading">
                              <span>
                                {local &&
                                directoryProvince
                                  ? `${directoryProvince} service`
                                  : organisation.organisation_type ||
                                    "Verified support"}
                              </span>

                              <h2>
                                {organisation.name}
                              </h2>
                            </div>
                          </div>

                          {organisation.description && (
                            <p className="verified-referral-description">
                              {
                                organisation.description
                              }
                            </p>
                          )}

                          {localOffice && (
                            <div className="provincial-office-card find-help-local-office">
                              <span className="provincial-office-label">
                                Verified local office
                              </span>

                              <h3>
                                {
                                  localOffice.office_name
                                }
                              </h3>

                              {localOffice.address && (
                                <div className="provincial-office-detail">
                                  <span>
                                    Address
                                  </span>

                                  <p>
                                    {
                                      localOffice.address
                                    }
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {(phone ||
                            email) && (
                            <div className="verified-referral-contact">
                              {phone && (
                                <div>
                                  <span>
                                    Phone
                                  </span>

                                  <a
                                    href={`tel:${phone}`}
                                  >
                                    {phone}
                                  </a>
                                </div>
                              )}

                              {email && (
                                <div>
                                  <span>
                                    Email
                                  </span>

                                  <a
                                    href={`mailto:${email}`}
                                  >
                                    {email}
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          {website && (
                            <a
                              className="verified-referral-action"
                              href={
                                website
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              Visit official
                              service

                              <span>
                                →
                              </span>
                            </a>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="find-help-empty">
                  <h2>
                    No matching verified
                    referrals
                  </h2>

                  <p>
                    Try another help type,
                    filter or search.
                  </p>
                </div>
              )}

              {userCoordinates && (
                <p className="find-help-location-privacy">
                  Your device coordinates
                  were used only to identify
                  your province for this
                  search. Verdict does not
                  use them as legal evidence
                  or send them to the AI.
                </p>
              )}
            </section>


            <section className="find-help-matter-card">
              <span>
                Looking for help with a
                specific matter?
              </span>

              <h2>
                Start with your
                situation.
              </h2>

              <p>
                Verdict can use the
                information in your
                matter to identify
                relevant verified
                support options.
              </p>

              <button
                type="button"
                onClick={
                  () =>
                    navigate(
                      "/matters/new"
                    )
                }
              >
                Start a matter

                <span>
                  →
                </span>
              </button>
            </section>
          </>
        )}


        <article className="find-help-safety">
          <strong>
            About referrals
          </strong>

          <p>
            Verdict does not guarantee
            that a listed service will
            accept your matter, provide
            representation or achieve a
            particular outcome.
            Eligibility, availability
            and fees may vary.
          </p>
        </article>

      </section>
    </main>
  );
}


export default FindHelp;