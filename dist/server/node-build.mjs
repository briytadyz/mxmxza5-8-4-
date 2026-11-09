import path from "path";
import * as express from "express";
import express__default from "express";
import cors from "cors";
import { randomUUID, createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
const handleDemo = (req, res) => {
  const response = {
    message: "Hello from Express server"
  };
  res.status(200).json(response);
};
const configuration$3 = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error("Hotel tenant database configuration is incomplete");
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), supabaseAnonKey, serviceRoleKey };
};
const serviceHeaders$3 = (json = false) => {
  const { supabaseAnonKey, serviceRoleKey } = configuration$3();
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...json ? { "content-type": "application/json" } : {}
  };
};
const hostnameFromRequest = (request) => {
  const hostname = request.hostname.toLowerCase().replace(/\.$/, "");
  return hostname;
};
const resolveRequestHotelTenant = async (request) => {
  const hostname = hostnameFromRequest(request);
  if (!hostname) throw new Error("Hotel domain is missing");
  process.env.BUILDER_PREVIEW_TENANT_ORGANIZATION_ID;
  hostname.endsWith(".projects.builder.my") || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const { supabaseUrl } = configuration$3();
  const tenantResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_hotel_tenant`, {
    method: "POST",
    headers: serviceHeaders$3(true),
    body: JSON.stringify({ target_hostname: hostname }),
    signal: AbortSignal.timeout(1e4)
  });
  const payload = await tenantResponse.json().catch(() => null);
  const tenants = Array.isArray(payload) ? payload : payload ? [payload] : [];
  if (!tenantResponse.ok || tenants.length !== 1) throw new Error("This hotel domain is not configured");
  const tenant = tenants[0];
  return {
    organizationId: tenant.organization_id,
    domain: tenant.domain,
    name: tenant.name,
    logoUrl: tenant.logo_url,
    primaryColor: tenant.primary_color,
    accentColor: tenant.accent_color
  };
};
const setPrivateTenantResponse = (response) => response.setHeader("Cache-Control", "private, no-store");
const readService$3 = async (path2) => {
  const { supabaseUrl } = configuration$3();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path2}`, {
    headers: serviceHeaders$3(),
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) throw new Error("Hotel information could not be loaded");
  return response.json();
};
const updateService = async (path2, body) => {
  const { supabaseUrl } = configuration$3();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path2}`, {
    method: "PATCH",
    headers: { ...serviceHeaders$3(true), Prefer: "return=minimal" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) throw new Error("Menu media information could not be saved");
};
const hotelOfferError = (message, status) => Object.assign(new Error(message), { status });
const writeService$2 = async (path2, method, body) => {
  const { supabaseUrl } = configuration$3();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path2}`, {
    method,
    headers: { ...serviceHeaders$3(true), Prefer: "return=representation" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) throw hotelOfferError("Hotel offer could not be saved", 503);
  return response.json();
};
const requireHotelManager$1 = async (request) => {
  const tenant = await resolveRequestHotelTenant(request);
  const userId = await getAuthenticatedUserId$2(request.headers.authorization);
  const organizationId = encodeURIComponent(tenant.organizationId);
  const userFilter = encodeURIComponent(userId);
  let profiles;
  let memberships;
  try {
    [profiles, memberships] = await Promise.all([
      readService$3(`user_profiles?user_id=eq.${userFilter}&select=role&limit=1`),
      readService$3(`books_memberships?organization_id=eq.${organizationId}&user_id=eq.${userFilter}&role=in.(owner,admin)&select=role&limit=1`)
    ]);
  } catch {
    throw hotelOfferError("Hotel manager access could not be verified", 503);
  }
  if (profiles[0]?.role !== "manager" || !memberships[0]) {
    throw hotelOfferError("Only a hotel manager can manage offers", 403);
  }
  return tenant;
};
const validateHotelOffer = (value) => {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const discountType = input.discount_type;
  const discountPercentage = Number(input.discount_percentage);
  const discountAmount = Number(input.discount_amount);
  const currencyCode = typeof input.currency_code === "string" ? input.currency_code.trim().toUpperCase() : "";
  const minimumSpend = Number(input.min_spend);
  const maximumDiscount = Number(input.max_discount);
  const maximumUses = input.max_uses === null || input.max_uses === "" ? null : Number(input.max_uses);
  const minimumNights = Number(input.minimum_nights);
  const displayOrder = Number(input.display_order);
  const promoCode = typeof input.promo_code === "string" && input.promo_code.trim() ? input.promo_code.trim().toUpperCase() : null;
  const terms = input.terms;
  const startsAt = input.starts_at === null || input.starts_at === "" ? null : input.starts_at;
  const endsAt = input.ends_at === null || input.ends_at === "" ? null : input.ends_at;
  const startsAtTimestamp = typeof startsAt === "string" ? Date.parse(startsAt) : null;
  const endsAtTimestamp = typeof endsAt === "string" ? Date.parse(endsAt) : null;
  if (!title || title.length > 120 || !description || description.length > 2e3 || discountType !== "percentage" && discountType !== "fixed" || !Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100 || !Number.isFinite(discountAmount) || discountAmount < 0 || discountType === "percentage" && discountPercentage <= 0 || discountType === "fixed" && (!promoCode || discountAmount <= 0) || !["USD", "UGX", "EUR", "GBP", "KES", "TZS", "RWF"].includes(currencyCode) || !Number.isFinite(minimumSpend) || minimumSpend < 0 || !Number.isFinite(maximumDiscount) || maximumDiscount < 0 || maximumUses !== null && (!Number.isInteger(maximumUses) || maximumUses < 1 || !promoCode) || promoCode !== null && !/^[A-Z0-9_-]{2,50}$/.test(promoCode) || !Number.isInteger(minimumNights) || minimumNights < 1 || !Number.isInteger(displayOrder) || displayOrder < 0 || typeof input.featured !== "boolean" || typeof input.is_active !== "boolean" || typeof input.limited_time !== "boolean" || !Array.isArray(terms) || terms.length > 12 || terms.some((term) => typeof term !== "string" || !term.trim() || term.length > 300) || startsAt !== null && (typeof startsAt !== "string" || !Number.isFinite(startsAtTimestamp)) || endsAt !== null && (typeof endsAt !== "string" || !Number.isFinite(endsAtTimestamp)) || startsAtTimestamp !== null && endsAtTimestamp !== null && endsAtTimestamp <= startsAtTimestamp) {
    throw new Error("Enter valid offer details and dates");
  }
  return {
    title,
    description,
    category: "accommodation",
    discount_type: discountType,
    discount_label: typeof input.discount_label === "string" ? input.discount_label.trim().slice(0, 40) : "",
    discount_percentage: discountPercentage,
    discount_amount: discountAmount,
    currency_code: currencyCode,
    minimum_nights: minimumNights,
    min_spend: minimumSpend,
    max_discount: maximumDiscount,
    max_uses: maximumUses,
    promo_code: promoCode,
    image: typeof input.image === "string" && input.image.trim() ? input.image.trim().slice(0, 8) : "🏨",
    popularity: Number.isInteger(Number(input.popularity)) ? Math.max(0, Math.min(100, Number(input.popularity))) : 0,
    limited_time: input.limited_time,
    display_order: displayOrder,
    featured: input.featured,
    terms: terms.map((term) => term.trim()),
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: input.is_active
  };
};
const callTenantRpc = async (name, args) => {
  const { supabaseUrl } = configuration$3();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders$3(true),
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(1e4)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string" ? payload.message : "Hotel information could not be loaded");
  }
  return payload;
};
const getAuthenticatedUserId$2 = async (authorization) => {
  if (!authorization?.startsWith("Bearer ")) throw new Error("Authentication is required");
  const { supabaseUrl, supabaseAnonKey } = configuration$3();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: authorization },
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) throw new Error("Your sign-in session has expired");
  const user = await response.json();
  if (!user.id) throw new Error("Your sign-in session could not be verified");
  return user.id;
};
const isUuid$1 = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const bindWorkerToHotelTenant = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    await callTenantRpc("bind_worker_to_hotel", {
      target_organization_id: tenant.organizationId,
      target_user_id: userId
    });
    response.json({ organizationId: tenant.organizationId });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to link worker to hotel" });
  }
};
const submitHotelEventProposal = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    const input = request.body;
    const planId = input.target_plan_id;
    if (planId !== null && planId !== void 0 && !isUuid$1(planId)) {
      response.status(400).json({ error: "Event proposal is invalid" });
      return;
    }
    const result = await callTenantRpc("submit_special_event_proposal_for_tenant", {
      target_organization_id: tenant.organizationId,
      target_user_id: userId,
      target_plan_id: planId ?? null,
      proposal_title: input.proposal_title,
      proposal_description: input.proposal_description ?? null,
      proposal_category: input.proposal_category,
      proposal_starts_at: input.proposal_starts_at,
      proposal_ends_at: input.proposal_ends_at,
      proposal_timezone: input.proposal_timezone,
      proposal_facility_id: input.proposal_facility_id,
      proposal_expected_guests: input.proposal_expected_guests,
      proposal_contact_name: input.proposal_contact_name,
      proposal_contact_email: input.proposal_contact_email,
      proposal_contact_phone: input.proposal_contact_phone ?? null,
      proposal_image_url: input.proposal_image_url ?? null,
      proposal_is_private: input.proposal_is_private,
      proposal_entry_type: input.proposal_entry_type,
      proposal_entry_fee: input.proposal_entry_fee,
      proposal_share_manager_operations: input.proposal_share_manager_operations ?? false
    });
    response.json({ planId: result });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to submit event proposal" });
  }
};
const reviewHotelEventProposal = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    const input = request.body;
    if (!isUuid$1(input.planId) || !["approve", "decline", "suggest_changes"].includes(String(input.action))) {
      response.status(400).json({ error: "Event review details are invalid" });
      return;
    }
    await callTenantRpc("review_special_event_proposal_for_tenant", {
      target_organization_id: tenant.organizationId,
      target_user_id: userId,
      target_plan_id: input.planId,
      review_action: input.action,
      suggested_values: input.suggestedValues ?? null,
      review_message: input.reviewMessage ?? null
    });
    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to review event proposal" });
  }
};
const respondHotelEventProposal = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    const { planId, acceptSuggestions } = request.body;
    if (!isUuid$1(planId) || typeof acceptSuggestions !== "boolean") {
      response.status(400).json({ error: "Event response details are invalid" });
      return;
    }
    await callTenantRpc("respond_to_special_event_proposal_for_tenant", {
      target_organization_id: tenant.organizationId,
      target_user_id: userId,
      target_plan_id: planId,
      accept_suggestions: acceptSuggestions
    });
    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to respond to event proposal" });
  }
};
const publishHotelEventProposal = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    const { planId } = request.body;
    if (!isUuid$1(planId)) {
      response.status(400).json({ error: "Event proposal is invalid" });
      return;
    }
    await callTenantRpc("publish_special_event_proposal_for_tenant", {
      target_organization_id: tenant.organizationId,
      target_user_id: userId,
      target_plan_id: planId
    });
    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to publish event proposal" });
  }
};
const deleteHotelEventProposal = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    const { planId } = request.body;
    if (!isUuid$1(planId)) {
      response.status(400).json({ error: "Event proposal is invalid" });
      return;
    }
    await callTenantRpc("delete_special_event_proposal_for_tenant", {
      target_organization_id: tenant.organizationId,
      target_user_id: userId,
      target_plan_id: planId
    });
    response.json({ success: true });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Unable to delete event proposal" });
  }
};
const submitHotelComplaint = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const input = request.body;
    const requiredText = (value, maximumLength) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximumLength;
    if (!requiredText(input.guestName, 160) || !requiredText(input.email, 320) || !requiredText(input.roomNumber, 64) || !requiredText(input.complaintType, 120) || !requiredText(input.description, 5e3) || !["low", "medium", "high", "urgent"].includes(String(input.priority))) {
      response.status(400).json({ error: "Complete the required complaint details" });
      return;
    }
    const userId = request.headers.authorization ? await getAuthenticatedUserId$2(request.headers.authorization) : null;
    const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = configuration$3();
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/complaints?select=id`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        user_id: userId,
        organization_id: tenant.organizationId,
        guest_name: String(input.guestName).trim(),
        email: String(input.email).trim().toLowerCase(),
        room_number: String(input.roomNumber).trim(),
        complaint_type: String(input.complaintType).trim(),
        description: String(input.description).trim(),
        priority: input.priority,
        status: "open",
        attachments: []
      }),
      signal: AbortSignal.timeout(1e4)
    });
    const rows = await insertResponse.json().catch(() => null);
    if (!insertResponse.ok || !rows?.[0]?.id) throw new Error("Complaint could not be submitted");
    setPrivateTenantResponse(response);
    response.status(201).json({ complaintId: rows[0].id });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Complaint could not be submitted" });
  }
};
const getHotelTenant = async (request, response) => {
  try {
    setPrivateTenantResponse(response);
    response.json(await resolveRequestHotelTenant(request));
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "This hotel domain is not configured" });
  }
};
const getHotelRewards = async (request, response) => {
  setPrivateTenantResponse(response);
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    const rewards = await callTenantRpc("get_hotel_loyalty_program_for_tenant", {
      target_organization_id: tenant.organizationId,
      target_user_id: userId
    });
    setPrivateTenantResponse(response);
    response.json(rewards);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hotel rewards could not be loaded";
    response.status(message.includes("Authentication") || message.includes("session has expired") ? 401 : 503).json({ error: message });
  }
};
const updateHotelRewardsEnrollment = async (request, response) => {
  setPrivateTenantResponse(response);
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    const { enrolled } = request.body;
    if (typeof enrolled !== "boolean") {
      response.status(400).json({ error: "Enrollment preference is invalid" });
      return;
    }
    const result = await callTenantRpc("set_hotel_loyalty_enrollment_for_tenant", {
      target_organization_id: tenant.organizationId,
      target_user_id: userId,
      target_enrolled: enrolled
    });
    setPrivateTenantResponse(response);
    response.json({ enrolled: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rewards preference could not be saved";
    response.status(message.includes("Authentication") || message.includes("session has expired") ? 401 : 503).json({ error: message });
  }
};
const getPublicHotelBookingData = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const organizationId = encodeURIComponent(tenant.organizationId);
    await callTenantRpc("release_expired_hotel_offer_holds_for_tenant", { target_organization_id: tenant.organizationId });
    const [settings, offers, rooms] = await Promise.all([
      readService$3(`hotel_tenant_settings?organization_id=eq.${organizationId}&select=booking_title,booking_subtitle&is_active=eq.true&limit=1`),
      readService$3(`hotel_booking_offers?organization_id=eq.${organizationId}&category=eq.accommodation&is_active=eq.true&select=id,title,description,discount_percentage,discount_type,discount_label,discount_amount,currency_code,min_spend,max_discount,promo_code,image,popularity,limited_time,minimum_nights,starts_at,ends_at,max_uses,usage_count&order=display_order`),
      readService$3(`hotel_public_room_listings?organization_id=eq.${organizationId}&select=id,organization_id,name,room_type,description,image_url,size_sqm,max_guests,available_units,nightly_rate,original_nightly_rate,currency_code,amenities,status,hotel_name,hotel_city,hotel_country,hotel_classification&order=nightly_rate`)
    ]);
    if (settings.length !== 1) throw new Error("Hotel booking content is not configured");
    setPrivateTenantResponse(response);
    response.json({ tenant, settings: { title: settings[0].booking_title, subtitle: settings[0].booking_subtitle }, offers, rooms });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "Hotel information could not be loaded" });
  }
};
const getPublicHotelOffers = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const organizationId = encodeURIComponent(tenant.organizationId);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await callTenantRpc("release_expired_hotel_offer_holds_for_tenant", { target_organization_id: tenant.organizationId });
    const [roomOffers, menuItems, loyaltyPrograms, events, spaServices] = await Promise.all([
      readService$3(`hotel_booking_offers?organization_id=eq.${organizationId}&category=eq.accommodation&is_active=eq.true&select=id,title,description,discount_percentage,discount_type,discount_label,discount_amount,currency_code,min_spend,max_discount,promo_code,image,popularity,limited_time,minimum_nights,starts_at,ends_at,display_order,featured,terms,max_uses,usage_count&order=display_order`),
      readService$3(`menu_items?organization_id=eq.${organizationId}&is_published=eq.true&special_offer=not.is.null&select=id,name,short_description,price,original_price,currency,special_offer,availability,max_availability&order=created_at.asc`),
      readService$3(`hotel_loyalty_programs?organization_id=eq.${organizationId}&program_enabled=eq.true&select=program_name,points_per_1000_ugx&limit=1`),
      readService$3(`special_events?organization_id=eq.${organizationId}&status=eq.published&is_private=eq.false&starts_at=gte.${encodeURIComponent(now)}&select=id,title,description,starts_at,ends_at,location,price,currency,category,image_url,featured&order=featured.desc,starts_at.asc`),
      readService$3(`hotel_spa_services?organization_id=eq.${organizationId}&is_active=eq.true&select=id,name,description,price,currency_code,duration_minutes&order=name.asc`)
    ]);
    const dateIsCurrent = (startsAt, endsAt) => (typeof startsAt !== "string" || new Date(startsAt).getTime() <= Date.now()) && (typeof endsAt !== "string" || new Date(endsAt).getTime() > Date.now());
    const offers = [
      ...roomOffers.filter((offer) => dateIsCurrent(offer.starts_at, offer.ends_at) && (offer.discount_type === "fixed" ? Boolean(offer.promo_code) && Number(offer.discount_amount) > 0 : Number(offer.discount_percentage) > 0)).map((offer) => ({ ...offer, discount: typeof offer.discount_label === "string" && offer.discount_label.trim() ? offer.discount_label : offer.discount_type === "fixed" ? `${offer.currency_code || ""} ${offer.discount_amount} OFF` : `${Number(offer.discount_percentage)}% OFF`, category: "accommodation", source: "booking" })),
      ...menuItems.filter((item) => typeof item.special_offer === "string" && item.special_offer.trim()).map((item) => ({ ...item, availability: item.availability === null ? null : Number(item.availability), title: item.name, description: `${item.special_offer}. ${item.short_description || ""}`.trim(), discount: item.original_price && Number(item.original_price) > Number(item.price) ? `${Math.round((1 - Number(item.price) / Number(item.original_price)) * 100)}% OFF` : "MENU SPECIAL", category: "dining", source: "menu" })),
      ...loyaltyPrograms.map((program) => ({ ...program, id: "hotel-rewards", title: program.program_name, description: `Earn ${program.points_per_1000_ugx} point${Number(program.points_per_1000_ugx) === 1 ? "" : "s"} for every UGX 1,000 spent on eligible purchases.`, discount: "REWARDS", category: "loyalty", source: "loyalty" })),
      ...events.filter((event) => typeof event.ends_at !== "string" || new Date(event.ends_at).getTime() > Date.now()).map((event) => ({ ...event, title: event.title, discount: event.price && Number(event.price) > 0 ? `FROM ${event.currency || ""} ${event.price}` : "UPCOMING EVENT", category: "seasonal", source: "event" })),
      ...spaServices.map((service) => ({ ...service, title: service.name, discount: `${service.currency_code} ${Number(service.price).toLocaleString()}`, category: "spa", image: "🧖", source: "spa" }))
    ];
    setPrivateTenantResponse(response);
    response.json({ tenant, offers });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "Offers could not be loaded" });
  }
};
const checkHotelOfferManagementAccess = async (request, response) => {
  try {
    await requireHotelManager$1(request);
    setPrivateTenantResponse(response);
    response.json({ authorized: true });
  } catch (error) {
    const status = error.status ?? (error instanceof Error && error.message.includes("Authentication") ? 401 : 503);
    response.status(status).json({ authorized: false });
  }
};
const getHotelOffersForManagement = async (request, response) => {
  try {
    const tenant = await requireHotelManager$1(request);
    const organizationId = encodeURIComponent(tenant.organizationId);
    await callTenantRpc("release_expired_hotel_offer_holds_for_tenant", { target_organization_id: tenant.organizationId });
    const offers = await readService$3(`hotel_booking_offers?organization_id=eq.${organizationId}&category=eq.accommodation&select=id,title,description,discount_percentage,discount_type,discount_label,discount_amount,currency_code,min_spend,max_discount,promo_code,image,popularity,limited_time,minimum_nights,starts_at,ends_at,display_order,featured,terms,max_uses,usage_count,is_active&order=display_order`);
    setPrivateTenantResponse(response);
    response.json({ offers });
  } catch (error) {
    const status = error.status ?? (error instanceof Error && error.message.includes("Authentication") ? 401 : 503);
    response.status(status).json({ error: error instanceof Error ? error.message : "Hotel offers could not be loaded" });
  }
};
const saveHotelOffer = async (request, response) => {
  try {
    const tenant = await requireHotelManager$1(request);
    const body = request.body;
    const offerId = body.id;
    if (offerId !== void 0 && (typeof offerId !== "string" || !isUuid$1(offerId))) {
      response.status(400).json({ error: "Offer identifier is invalid" });
      return;
    }
    const offer = validateHotelOffer(body);
    const organizationId = encodeURIComponent(tenant.organizationId);
    if (typeof offerId === "string") {
      const updated = await writeService$2(`hotel_booking_offers?id=eq.${encodeURIComponent(offerId)}&organization_id=eq.${organizationId}&select=id`, "PATCH", offer);
      if (!updated.length) {
        throw hotelOfferError("Offer was not found for this hotel", 404);
      }
    } else {
      await writeService$2("hotel_booking_offers?select=id", "POST", { ...offer, organization_id: tenant.organizationId });
    }
    setPrivateTenantResponse(response);
    response.json({ ok: true });
  } catch (error) {
    const status = error.status ?? (error instanceof Error && error.message.includes("Authentication") ? 401 : 400);
    response.status(status).json({ error: error instanceof Error ? error.message : "Hotel offer could not be saved" });
  }
};
const getPublicMenuItems = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const organizationId = encodeURIComponent(tenant.organizationId);
    const select = "id,organization_id,name,short_description,full_description,currency,media_type,media_url,media_attachment_id,media_aspect_ratio,price,original_price,category,icon,preparation_time,availability,max_availability,dietary_tags,spice_level,origin,calories,chef_note,special_offer,status_labels,is_trending,is_published,created_at";
    const legacySelect = select.replace(",media_aspect_ratio", "");
    let items;
    try {
      items = await readService$3(`menu_items?organization_id=eq.${organizationId}&is_published=eq.true&select=${select}&order=created_at.asc`);
    } catch {
      items = await readService$3(`menu_items?organization_id=eq.${organizationId}&is_published=eq.true&select=${legacySelect}&order=created_at.asc`);
    }
    setPrivateTenantResponse(response);
    response.json({ tenant, items });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "Menu information could not be loaded" });
  }
};
const requestHotelMenuAvailability = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const userId = await getAuthenticatedUserId$2(request.headers.authorization);
    const { menuItemId } = request.body;
    if (!isUuid$1(menuItemId)) {
      response.status(400).json({ error: "Select a valid menu item" });
      return;
    }
    const subscribed = await callTenantRpc("request_menu_item_availability_for_tenant", {
      target_user_id: userId,
      target_organization_id: tenant.organizationId,
      target_menu_item_id: menuItemId
    });
    setPrivateTenantResponse(response);
    response.json({ subscribed });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Availability request could not be saved" });
  }
};
const muxAspectRatios = /* @__PURE__ */ new Map();
const getMuxAspectRatio = async (playbackId) => {
  const cachedRatio = muxAspectRatios.get(playbackId);
  if (cachedRatio) return cachedRatio;
  try {
    const manifestResponse = await fetch(`https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8`, {
      signal: AbortSignal.timeout(5e3)
    });
    if (!manifestResponse.ok) return null;
    const manifest = await manifestResponse.text();
    const resolution = manifest.match(/RESOLUTION=(\d+)x(\d+)/);
    if (!resolution) return null;
    const aspectRatio = Number(resolution[1]) / Number(resolution[2]);
    muxAspectRatios.set(playbackId, aspectRatio);
    return aspectRatio;
  } catch {
    return null;
  }
};
const getPublicMenuVideo = async (request, response) => {
  try {
    const { attachmentId } = request.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attachmentId)) {
      response.status(400).json({ error: "Invalid menu media" });
      return;
    }
    const tenant = await resolveRequestHotelTenant(request);
    const organizationId = encodeURIComponent(tenant.organizationId);
    const encodedAttachmentId = encodeURIComponent(attachmentId);
    let menuItems;
    try {
      menuItems = await readService$3(
        `menu_items?organization_id=eq.${organizationId}&media_attachment_id=eq.${encodedAttachmentId}&media_type=eq.video&is_published=eq.true&select=id,media_aspect_ratio&limit=1`
      );
    } catch {
      menuItems = await readService$3(
        `menu_items?organization_id=eq.${organizationId}&media_attachment_id=eq.${encodedAttachmentId}&media_type=eq.video&is_published=eq.true&select=id&limit=1`
      );
    }
    if (menuItems.length === 0) {
      response.status(404).json({ error: "Menu video was not found" });
      return;
    }
    const attachments = await readService$3(
      `attachments?id=eq.${encodedAttachmentId}&select=filename&limit=1`
    );
    if (attachments.length === 0) {
      response.status(404).json({ error: "Menu video was not found" });
      return;
    }
    const filename = encodeURIComponent(attachments[0].filename);
    const videos = await readService$3(
      `video_uploads?filename=eq.${filename}&select=playback_id,status&limit=1`
    );
    const video = videos[0];
    const playbackId = video?.status === "ready" ? video.playback_id : null;
    const menuItem = menuItems[0];
    let aspectRatio = menuItem.media_aspect_ratio;
    if (playbackId && !(aspectRatio && Number.isFinite(aspectRatio) && aspectRatio > 0)) {
      aspectRatio = await getMuxAspectRatio(playbackId);
      if (aspectRatio) {
        try {
          await updateService(
            `menu_items?id=eq.${encodeURIComponent(menuItem.id)}&organization_id=eq.${organizationId}`,
            { media_aspect_ratio: aspectRatio }
          );
        } catch {
        }
      }
    }
    setPrivateTenantResponse(response);
    response.json({
      status: video?.status || "pending",
      playbackId,
      aspectRatio
    });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "Menu video could not be loaded" });
  }
};
const getPublicSpecialEvents = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const organizationId = encodeURIComponent(tenant.organizationId);
    const select = "id,title,description,starts_at,ends_at,timezone,location,facility_id,organization_id,is_private,share_token,price,currency,capacity,ticket_type_capacity,max_tickets_per_order,default_ticket_type_id,attendees_count,category,image_url,featured,rating,host_name,status,organizer_id,created_at,updated_at";
    const events = await readService$3(`special_events?organization_id=eq.${organizationId}&status=eq.published&is_private=eq.false&starts_at=gte.${encodeURIComponent((/* @__PURE__ */ new Date()).toISOString())}&select=${select}&order=featured.desc,starts_at.asc`);
    setPrivateTenantResponse(response);
    response.json({ events });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "Event information could not be loaded" });
  }
};
const getTenantRoomAvailability = async (request, response) => {
  try {
    const { checkIn, checkOut } = request.body;
    if (!checkIn || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !checkOut || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
      response.status(400).json({ error: "Select valid check-in and check-out dates" });
      return;
    }
    const tenant = await resolveRequestHotelTenant(request);
    const availability = await callTenantRpc(
      "get_hotel_room_availability_for_tenant",
      { target_organization_id: tenant.organizationId, target_check_in: checkIn, target_check_out: checkOut }
    );
    setPrivateTenantResponse(response);
    response.json({ availability });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "Hotel availability could not be loaded" });
  }
};
const flutterwaveBaseUrl$2 = "https://api.flutterwave.com/v3";
const flutterwaveReturnPath$1 = "/checkout/flutterwave-return";
class FlutterwaveRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const getFlutterwaveReturnUrl = (domain) => {
  const returnUrl2 = process.env.FLUTTERWAVE_RETURN_URL;
  if (!returnUrl2) throw new Error("Flutterwave return URL is not configured");
  const parsedUrl = new URL(returnUrl2);
  if (parsedUrl.protocol !== "https:" || parsedUrl.pathname !== flutterwaveReturnPath$1) {
    throw new Error("Flutterwave return URL must use HTTPS and target the payment return route");
  }
  parsedUrl.hostname = domain;
  return parsedUrl.toString();
};
const getConfiguration$3 = () => {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const defaultCurrency = process.env.FLUTTERWAVE_CURRENCY || "USD";
  if (!secretKey || !secretHash || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error("Flutterwave payment configuration is incomplete");
  }
  return {
    secretKey,
    secretHash,
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    defaultCurrency
  };
};
const getAuthenticatedOrder = async (orderId, authorization) => {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing authenticated session");
  }
  const { supabaseUrl, supabaseAnonKey } = getConfiguration$3();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/menu_orders?id=eq.${encodeURIComponent(orderId)}&select=*`,
    {
      headers: {
        apikey: supabaseAnonKey,
        authorization
      }
    }
  );
  if (!response.ok) throw new Error("Unable to retrieve this order");
  const [order] = await response.json();
  if (!order) throw new Error("Order not found");
  return order;
};
const getPaymentAttempt = async (txRef) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$3();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/menu_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}&select=id,order_id,tx_ref,transaction_id,amount,currency,status`,
    { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseServiceRoleKey}` } }
  );
  if (!response.ok) throw new Error("Unable to retrieve payment attempt");
  const [attempt] = await response.json();
  if (!attempt) throw new Error("Payment attempt not found");
  return attempt;
};
const getOrderByIdAsService = async (orderId) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$3();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/menu_orders?id=eq.${encodeURIComponent(orderId)}&select=*`,
    { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseServiceRoleKey}` } }
  );
  if (!response.ok) throw new Error("Unable to retrieve payment order");
  const [order] = await response.json();
  if (!order) throw new Error("Payment order not found");
  return order;
};
const getOrderByPaymentReference = async (paymentReference) => {
  const attempt = await getPaymentAttempt(paymentReference);
  return getOrderByIdAsService(attempt.order_id);
};
const updatePaymentAttemptAsService = async (txRef, values) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$3();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/menu_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "content-type": "application/json",
        prefer: "return=minimal"
      },
      body: JSON.stringify({ ...values, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
    }
  );
  if (!response.ok) {
    const details = (await response.text()).slice(0, 1e3);
    console.error("Menu payment attempt update failed", { status: response.status, details });
    throw new Error("Unable to update payment attempt");
  }
};
const updatePendingOrderAsService = async (orderId, values, txRef) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$3();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/menu_orders?id=eq.${encodeURIComponent(orderId)}&payment_status=eq.pending&payment_reference=eq.${encodeURIComponent(txRef)}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "content-type": "application/json",
        prefer: "return=minimal"
      },
      body: JSON.stringify({ ...values, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
    }
  );
  if (!response.ok) throw new Error("Unable to update payment order");
};
const confirmMenuPaymentAsService = async (orderId, txRef, transactionId) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$3();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/confirm_menu_flutterwave_payment`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      target_order_id: orderId,
      target_tx_ref: txRef,
      target_transaction_id: transactionId
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !("paymentStatus" in payload)) {
    const details = payload && "message" in payload ? payload.message : void 0;
    console.error("Atomic menu payment confirmation failed", { status: response.status, details });
    throw new Error(details || "Unable to confirm the menu payment with Supabase.");
  }
  return payload;
};
const getPaymentOptions = (paymentMethod, currency) => {
  if (paymentMethod !== "mobile-money") return "card";
  if (currency !== "UGX") {
    throw new Error("Mobile Money is available only when checkout prices are configured in UGX.");
  }
  return "mobilemoneyuganda";
};
const verifyTransaction$2 = async (transactionId) => {
  const { secretKey } = getConfiguration$3();
  const response = await fetch(
    `${flutterwaveBaseUrl$2}/transactions/${encodeURIComponent(transactionId)}/verify`,
    { headers: { Authorization: `Bearer ${secretKey}` } }
  );
  const payload = await response.json();
  if (!response.ok || payload.status !== "success" || !payload.data) {
    throw new Error("Payment could not be verified");
  }
  return payload.data;
};
const confirmPayment = async (transaction, transactionReference, order) => {
  const metadataOrderId = transaction.meta?.order_id;
  if (metadataOrderId !== order.id) {
    throw new Error("Payment metadata does not match the order");
  }
  const { defaultCurrency } = getConfiguration$3();
  const currency = String(order.currency || defaultCurrency).toUpperCase();
  if (transaction.status !== "successful" || transaction.tx_ref !== transactionReference || Number(transaction.amount) !== Number(order.total_amount) || transaction.currency !== currency) {
    throw new Error("Payment verification data does not match the order");
  }
  const attempt = await getPaymentAttempt(transactionReference);
  if (Number(attempt.amount) !== Number(order.total_amount) || attempt.currency.toUpperCase() !== currency || attempt.order_id !== order.id) {
    throw new Error("Payment attempt does not match the order total");
  }
  const confirmation = await confirmMenuPaymentAsService(order.id, transactionReference, String(transaction.id));
  if (confirmation.paymentStatus === "manual_review") {
    return { order, paymentStatus: "manual_review" };
  }
  return {
    order: {
      ...order,
      status: "confirmed",
      payment_status: "paid",
      payment_reference: transactionReference,
      flutterwave_transaction_id: String(transaction.id)
    },
    paymentStatus: "paid"
  };
};
const createMenuPaymentAttempt = async (order, txRef) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$3();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_menu_payment_attempt`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "content-type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ target_order_id: order.id, target_user_id: order.user_id, target_tx_ref: txRef })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && !Array.isArray(payload) && typeof payload.message === "string" ? payload.message : "Unable to create a secure payment attempt";
    throw new Error(message);
  }
  const [attempt] = Array.isArray(payload) ? payload : [];
  if (!attempt) throw new Error("Payment attempt was not returned");
  return attempt;
};
const prepareFlutterwaveHostedSession = async ({ orderId }, tenantOrganizationId, tenantDomain, authorization) => {
  let txRef;
  try {
    if (!orderId) throw new Error("Order ID is required");
    const order = await getAuthenticatedOrder(orderId, authorization);
    if (order.organization_id !== tenantOrganizationId) {
      throw new FlutterwaveRequestError("This order is not available for this hotel", 404);
    }
    if (order.payment_status === "paid") {
      throw new FlutterwaveRequestError("This order has already been paid", 409);
    }
    if (!order.email?.trim()) {
      throw new FlutterwaveRequestError("An email address is required for online payment.", 400);
    }
    const { secretKey } = getConfiguration$3();
    let attempt = await createMenuPaymentAttempt(order, `sheraton-${order.order_number}-${crypto.randomUUID()}`);
    if (attempt.attempt_status === "redirected") {
      const existingAttempt = await getPaymentAttempt(attempt.attempt_tx_ref);
      if (existingAttempt.status !== "redirected") {
        throw new FlutterwaveRequestError("Payment status changed. Refresh the order and try again.", 409);
      }
      const amountMatchesOrder = Number(existingAttempt.amount) === Number(order.total_amount) && existingAttempt.currency.toUpperCase() === String(order.currency || "").toUpperCase() && existingAttempt.order_id === order.id;
      if (amountMatchesOrder && attempt.attempt_payment_url) {
        return { paymentUrl: attempt.attempt_payment_url, txRef: attempt.attempt_tx_ref, orderId: order.id };
      }
      await updatePaymentAttemptAsService(existingAttempt.tx_ref, {
        status: "failed",
        failure_reason: "Checkout amount no longer matches the current order total"
      });
      attempt = await createMenuPaymentAttempt(order, `sheraton-${order.order_number}-${crypto.randomUUID()}`);
    }
    if (attempt.attempt_status === "preparing") {
      throw new FlutterwaveRequestError("Secure checkout is already being prepared. Try again shortly.", 409);
    }
    txRef = attempt.attempt_tx_ref;
    const storedAttempt = await getPaymentAttempt(txRef);
    const amount = Number(storedAttempt.amount);
    const currency = storedAttempt.currency.toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount !== Number(order.total_amount) || currency !== String(order.currency || "").toUpperCase()) {
      throw new Error("Stored payment attempt does not match the order total");
    }
    const response = await fetch(`${flutterwaveBaseUrl$2}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency,
        payment_options: getPaymentOptions(order.payment_method, currency),
        redirect_url: getFlutterwaveReturnUrl(tenantDomain),
        customer: {
          email: order.email,
          name: `${order.first_name} ${order.last_name}`.trim(),
          phonenumber: order.phone
        },
        meta: { order_id: order.id },
        customizations: { title: "Sheraton Special", description: `Order ${order.order_number}` }
      })
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== "success" || !payload.data?.link) {
      throw new Error("Unable to create secure payment page");
    }
    await updatePaymentAttemptAsService(txRef, { status: "redirected", payment_url: payload.data.link });
    return { paymentUrl: payload.data.link, txRef, orderId: order.id };
  } catch (error) {
    if (txRef) {
      await updatePaymentAttemptAsService(txRef, {
        status: "failed",
        failure_reason: error instanceof Error ? error.message : "Unable to prepare payment"
      }).catch((attemptError) => console.error("Unable to record failed payment attempt", attemptError));
    }
    throw error;
  }
};
const createFlutterwaveHostedSession = async (req, res) => {
  try {
    const tenant = await resolveRequestHotelTenant(req);
    const paymentSession = await prepareFlutterwaveHostedSession(
      req.body,
      tenant.organizationId,
      tenant.domain,
      req.headers.authorization
    );
    return res.json(paymentSession);
  } catch (error) {
    console.error("Flutterwave hosted session error", error);
    return res.status(error instanceof FlutterwaveRequestError ? error.status : 400).json({
      error: error instanceof Error ? error.message : "Unable to prepare payment"
    });
  }
};
const cancelFlutterwavePayment = async (req, res) => {
  try {
    const { txRef, status } = req.body;
    if (!txRef) return res.status(400).json({ error: "Payment reference is required" });
    if (status !== "cancelled" && status !== "failed") {
      return res.status(400).json({ error: "Payment outcome is invalid" });
    }
    const tenant = await resolveRequestHotelTenant(req);
    const attempt = await getPaymentAttempt(txRef);
    const order = await getOrderByIdAsService(attempt.order_id);
    const authenticatedOrder = await getAuthenticatedOrder(order.id, req.headers.authorization);
    if (authenticatedOrder.organization_id !== tenant.organizationId) throw new FlutterwaveRequestError("This order is not available for this hotel", 404);
    if (attempt.status === "completed" || attempt.status === "manual_review" || order.payment_status === "paid") {
      return res.json({ orderId: order.id, paymentStatus: order.payment_status });
    }
    if (attempt.status === "initiated" || attempt.status === "redirected") {
      await updatePaymentAttemptAsService(txRef, {
        status,
        ...status === "cancelled" ? { cancelled_at: (/* @__PURE__ */ new Date()).toISOString() } : { failure_reason: "Flutterwave returned an unsuccessful payment status" }
      });
      await updatePendingOrderAsService(order.id, { payment_status: status }, txRef);
    }
    return res.json({ orderId: order.id, paymentStatus: status });
  } catch (error) {
    console.error("Flutterwave payment cancellation error", error);
    return res.status(error instanceof FlutterwaveRequestError ? error.status : 400).json({
      error: error instanceof Error ? error.message : "Unable to record payment cancellation"
    });
  }
};
const verifyFlutterwavePayment = async (req, res) => {
  try {
    const { transactionId, txRef } = req.body;
    if (!transactionId || !txRef) {
      return res.status(400).json({ error: "Payment verification details are required" });
    }
    const tenant = await resolveRequestHotelTenant(req);
    const order = await getOrderByPaymentReference(txRef);
    const authenticatedOrder = await getAuthenticatedOrder(order.id, req.headers.authorization);
    if (authenticatedOrder.organization_id !== tenant.organizationId) throw new FlutterwaveRequestError("This order is not available for this hotel", 404);
    const transaction = await verifyTransaction$2(String(transactionId));
    const result = await confirmPayment(transaction, txRef, order);
    return res.json({
      orderId: result.order.id,
      orderNumber: result.order.order_number,
      paymentStatus: result.paymentStatus
    });
  } catch (error) {
    console.error("Flutterwave payment verification error", error);
    return res.status(error instanceof FlutterwaveRequestError ? error.status : 400).json({
      error: error instanceof Error ? error.message : "Unable to verify payment"
    });
  }
};
const handleFlutterwaveWebhook = async (req, res) => {
  const signature = req.headers["verif-hash"];
  const { secretHash } = getConfiguration$3();
  if (!signature || signature !== secretHash) {
    return res.status(401).end();
  }
  const payload = req.body;
  if (payload.event !== "charge.completed" || !payload.data?.id || !payload.data.tx_ref) {
    return res.status(200).end();
  }
  try {
    const order = await getOrderByPaymentReference(payload.data.tx_ref);
    await confirmPayment(
      await verifyTransaction$2(String(payload.data.id)),
      payload.data.tx_ref,
      order
    );
    return res.status(200).end();
  } catch (error) {
    console.error("Flutterwave webhook processing error", error);
    return res.status(500).end();
  }
};
const flutterwaveBaseUrl$1 = "https://api.flutterwave.com/v3";
const flutterwaveReturnPath = "/checkout/flutterwave-return";
class SpecialEventPaymentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const getConfiguration$2 = () => {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error("Event payment configuration is incomplete");
  }
  return { secretKey, secretHash, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
};
const getAuthenticatedEventUserId = async (authorization) => {
  if (!authorization?.startsWith("Bearer ")) throw new SpecialEventPaymentError("Missing authenticated session", 401);
  const { supabaseUrl, supabaseAnonKey } = getConfiguration$2();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: authorization },
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) throw new SpecialEventPaymentError("Your sign-in session has expired", 401);
  const user = await response.json();
  if (!user.id) throw new SpecialEventPaymentError("Your sign-in session could not be verified", 401);
  return user.id;
};
const callTenantEventRpc = async (name, args) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...restHeaders(supabaseServiceRoleKey, supabaseAnonKey, true), Prefer: "return=representation" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15e3)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string" ? payload.message : "Unable to create event booking");
  return payload;
};
const assertEventBookingTenant = async (request, booking) => {
  const tenant = await resolveRequestHotelTenant(request);
  if (booking.organization_id !== tenant.organizationId) {
    throw new SpecialEventPaymentError("This event booking is not available for this hotel", 404);
  }
  return tenant;
};
const getReturnUrl$1 = (domain) => {
  const value = process.env.FLUTTERWAVE_RETURN_URL;
  if (!value) throw new Error("Flutterwave return URL is not configured");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.pathname !== flutterwaveReturnPath) {
    throw new Error("Flutterwave return URL must use HTTPS and target the payment return route");
  }
  parsed.hostname = domain;
  return parsed.toString();
};
const restHeaders = (token, anonKey, json = false) => ({
  apikey: anonKey,
  Authorization: `Bearer ${token}`,
  ...json ? { "content-type": "application/json" } : {}
});
const getBooking$1 = async (bookingId, authorization) => {
  if (!authorization?.startsWith("Bearer ")) throw new SpecialEventPaymentError("Missing authenticated session", 401);
  const { supabaseUrl, supabaseAnonKey } = getConfiguration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/special_event_bookings?id=eq.${encodeURIComponent(bookingId)}&select=*`, {
    headers: restHeaders(authorization.slice("Bearer ".length), supabaseAnonKey)
  });
  if (!response.ok) throw new Error("Unable to retrieve event booking");
  const [booking] = await response.json();
  if (!booking) throw new SpecialEventPaymentError("Event booking not found", 404);
  return booking;
};
const getBookingAsService = async (bookingId) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/special_event_bookings?id=eq.${encodeURIComponent(bookingId)}&select=*`, {
    headers: restHeaders(supabaseServiceRoleKey, supabaseAnonKey)
  });
  if (!response.ok) throw new Error("Unable to retrieve event booking");
  const [booking] = await response.json();
  if (!booking) throw new Error("Event booking not found");
  return booking;
};
const getPaymentAttemptAsService = async (txRef) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/special_event_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}&select=id,booking_id,tx_ref,transaction_id,amount,currency,status`, {
    headers: restHeaders(supabaseServiceRoleKey, supabaseAnonKey)
  });
  if (!response.ok) throw new Error("Unable to retrieve event payment attempt");
  const [attempt] = await response.json();
  if (!attempt) throw new SpecialEventPaymentError("Event payment attempt not found", 404);
  return attempt;
};
const getActivePaymentAttempt = async (bookingId) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$2();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/special_event_payment_attempts?booking_id=eq.${encodeURIComponent(bookingId)}&status=in.(initiated,redirected,verified)&select=id,booking_id,tx_ref,transaction_id,amount,currency,status,payment_url,created_at&order=created_at.desc&limit=1`,
    { headers: restHeaders(supabaseServiceRoleKey, supabaseAnonKey) }
  );
  if (!response.ok) throw new Error("Unable to retrieve active event payment attempt");
  const [attempt] = await response.json();
  return attempt || null;
};
const createPaymentAttempt = async (values) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/special_event_payment_attempts`, {
    method: "POST",
    headers: { ...restHeaders(supabaseServiceRoleKey, supabaseAnonKey, true), Prefer: "return=minimal" },
    body: JSON.stringify(values)
  });
  if (!response.ok) throw new Error("Unable to create event payment attempt");
};
const updatePaymentAttempt = async (txRef, values) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/special_event_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}`, {
    method: "PATCH",
    headers: { ...restHeaders(supabaseServiceRoleKey, supabaseAnonKey, true), Prefer: "return=minimal" },
    body: JSON.stringify({ ...values, updated_at: (/* @__PURE__ */ new Date()).toISOString() })
  });
  if (!response.ok) throw new Error("Unable to update event payment attempt");
};
const verifyTransaction$1 = async (transactionId) => {
  const { secretKey } = getConfiguration$2();
  const response = await fetch(`${flutterwaveBaseUrl$1}/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== "success" || !payload.data) throw new Error("Event payment could not be verified");
  return payload.data;
};
const confirmBookingAsService = async (bookingId, transactionId) => {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getConfiguration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/confirm_special_event_payment`, {
    method: "POST",
    headers: { ...restHeaders(supabaseServiceRoleKey, supabaseAnonKey, true), Prefer: "return=representation" },
    body: JSON.stringify({ target_booking_id: bookingId, target_transaction_id: transactionId })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && !Array.isArray(payload) ? [payload.message, payload.details, payload.hint].filter((value) => typeof value === "string" && Boolean(value.trim())).join(" — ") : "";
    throw new Error(error || "Unable to confirm event booking");
  }
  const [confirmation] = Array.isArray(payload) ? payload : [];
  if (!confirmation) throw new Error("Event booking confirmation was not returned");
  return confirmation;
};
const assertTransactionMatches = (transaction, attempt, booking) => {
  if (transaction.status !== "successful" || transaction.tx_ref !== attempt.tx_ref) throw new Error("Event payment status does not match the booking");
  if (Number(transaction.amount) !== Number(booking.total_amount) || Number(transaction.amount) !== Number(attempt.amount) || transaction.currency.toUpperCase() !== booking.currency.toUpperCase() || transaction.currency.toUpperCase() !== attempt.currency.toUpperCase()) throw new Error("Event payment amount does not match the booking");
  if (transaction.meta?.booking_id !== booking.id) throw new Error("Event payment metadata does not match the booking");
};
const createSpecialEventBooking = async (req, res) => {
  try {
    const tenant = await resolveRequestHotelTenant(req);
    const userId = await getAuthenticatedEventUserId(req.headers.authorization);
    const input = req.body;
    if (!input.eventId || !/^[0-9a-f-]{36}$/i.test(input.eventId) || !Number.isInteger(input.quantity) || !input.idempotencyKey || !/^[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(input.idempotencyKey)) {
      throw new SpecialEventPaymentError("Event booking details are invalid");
    }
    const rows = await callTenantEventRpc(
      "create_special_event_booking_for_tenant",
      {
        target_organization_id: tenant.organizationId,
        target_user_id: userId,
        target_event_id: input.eventId,
        target_quantity: input.quantity,
        guest_first_name: input.firstName,
        guest_last_name: input.lastName,
        guest_email: input.email,
        guest_phone: input.phone || null,
        special_requests: input.specialRequests || null,
        target_ticket_type_id: input.ticketTypeId || null,
        target_idempotency_key: input.idempotencyKey,
        target_attendee_names: input.attendeeNames || null,
        target_invitation_id: input.invitationId || null,
        target_share_token: input.shareToken || null,
        target_business_purchase: input.businessPurchase === true,
        target_buyer_tax_id: input.buyerTaxId || null
      }
    );
    const [booking] = rows;
    if (!booking) throw new Error("Event booking was not returned");
    return res.status(201).json(booking);
  } catch (error) {
    return res.status(error instanceof SpecialEventPaymentError ? error.status : 400).json({ error: error instanceof Error ? error.message : "Unable to create event booking" });
  }
};
const confirmFreeSpecialEventBooking = async (req, res) => {
  try {
    const tenant = await resolveRequestHotelTenant(req);
    const userId = await getAuthenticatedEventUserId(req.headers.authorization);
    const { bookingId } = req.body;
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) throw new SpecialEventPaymentError("Event booking is invalid");
    const rows = await callTenantEventRpc(
      "confirm_free_special_event_booking_for_tenant",
      { target_organization_id: tenant.organizationId, target_user_id: userId, target_booking_id: bookingId }
    );
    const [confirmation] = rows;
    if (!confirmation) throw new Error("Event confirmation was not returned");
    return res.json(confirmation);
  } catch (error) {
    return res.status(error instanceof SpecialEventPaymentError ? error.status : 400).json({ error: error instanceof Error ? error.message : "Unable to confirm free event booking" });
  }
};
const prepareSpecialEventPayment = async (req, res) => {
  let bookingId;
  let txRef;
  try {
    bookingId = req.body.bookingId;
    if (!bookingId) throw new SpecialEventPaymentError("Booking ID is required");
    const booking = await getBooking$1(bookingId, req.headers.authorization);
    const tenant = await assertEventBookingTenant(req, booking);
    if (booking.payment_status === "paid") throw new SpecialEventPaymentError("This event booking has already been paid", 409);
    if (booking.status !== "pending" || booking.payment_status !== "pending") throw new SpecialEventPaymentError("This event booking is no longer pending", 409);
    if (booking.expires_at && new Date(booking.expires_at).getTime() <= Date.now()) throw new SpecialEventPaymentError("This ticket hold has expired. Start a new booking.", 409);
    if (Number(booking.total_amount) <= 0) throw new SpecialEventPaymentError("This booking does not require online payment", 400);
    const { secretKey } = getConfiguration$2();
    const activeAttempt = await getActivePaymentAttempt(booking.id);
    if (activeAttempt?.status === "redirected" && activeAttempt.payment_url) {
      return res.json({ paymentUrl: activeAttempt.payment_url, txRef: activeAttempt.tx_ref, bookingId: booking.id });
    }
    if (activeAttempt?.status === "verified") {
      throw new SpecialEventPaymentError("Payment verification is still processing. Refresh My Events shortly.", 409);
    }
    if (activeAttempt?.status === "initiated") {
      const attemptAge = Date.now() - new Date(activeAttempt.created_at).getTime();
      if (attemptAge < 12e4) {
        throw new SpecialEventPaymentError("Secure checkout is being prepared. Try again in a moment.", 409);
      }
      await updatePaymentAttempt(activeAttempt.tx_ref, { status: "expired", failure_reason: "Checkout preparation timed out" });
    }
    txRef = `special-event-${booking.order_number}-${randomUUID()}`;
    try {
      await createPaymentAttempt({ booking_id: booking.id, tx_ref: txRef, amount: Number(booking.total_amount), currency: booking.currency, status: "initiated" });
    } catch (error) {
      const racedAttempt = await getActivePaymentAttempt(booking.id);
      if (racedAttempt?.status === "redirected" && racedAttempt.payment_url) {
        return res.json({ paymentUrl: racedAttempt.payment_url, txRef: racedAttempt.tx_ref, bookingId: booking.id });
      }
      if (racedAttempt?.status === "initiated" || racedAttempt?.status === "verified") {
        throw new SpecialEventPaymentError("Secure checkout is already being prepared. Try again shortly.", 409);
      }
      throw error;
    }
    const response = await fetch(`${flutterwaveBaseUrl$1}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: Number(booking.total_amount),
        currency: booking.currency,
        payment_options: "card",
        redirect_url: getReturnUrl$1(tenant.domain),
        customer: { email: booking.guest_email, name: `${booking.guest_first_name} ${booking.guest_last_name}`.trim(), phonenumber: booking.guest_phone },
        meta: { booking_id: booking.id, order_number: booking.order_number },
        customizations: { title: "Special Events", description: `Event booking ${booking.order_number}` }
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status !== "success" || !payload.data?.link) {
      const providerMessage = typeof payload?.message === "string" ? payload.message : "Flutterwave did not return a checkout link";
      throw new SpecialEventPaymentError(`Flutterwave checkout failed: ${providerMessage}`, 502);
    }
    await updatePaymentAttempt(txRef, { status: "redirected", payment_url: payload.data.link });
    return res.json({ paymentUrl: payload.data.link, txRef, bookingId: booking.id });
  } catch (error) {
    console.error("Special event checkout initialization failed", { bookingId, txRef, error });
    if (txRef) await updatePaymentAttempt(txRef, { status: "failed", failure_reason: error instanceof Error ? error.message : "Unable to prepare event payment" }).catch(() => void 0);
    return res.status(error instanceof SpecialEventPaymentError ? error.status : 502).json({ error: error instanceof Error ? error.message : "Unable to prepare event payment" });
  }
};
const verifySpecialEventPayment = async (req, res) => {
  try {
    const { transactionId, txRef } = req.body;
    if (!transactionId || !txRef) return res.status(400).json({ error: "Event payment verification details are required" });
    const attempt = await getPaymentAttemptAsService(txRef);
    const booking = await getBooking$1(attempt.booking_id, req.headers.authorization);
    await assertEventBookingTenant(req, booking);
    const transaction = await verifyTransaction$1(String(transactionId));
    assertTransactionMatches(transaction, attempt, booking);
    if (attempt.status !== "successful" && attempt.status !== "manual_review") {
      await updatePaymentAttempt(txRef, { transaction_id: String(transaction.id), status: "verified" });
    }
    const confirmation = await confirmBookingAsService(booking.id, String(transaction.id));
    return res.json({ bookingId: confirmation.booking_id, orderNumber: confirmation.order_number, confirmationNumber: confirmation.confirmation_number, ticketCode: confirmation.ticket_code, paymentStatus: confirmation.payment_status });
  } catch (error) {
    return res.status(error instanceof SpecialEventPaymentError ? error.status : 400).json({ error: error instanceof Error ? error.message : "Unable to verify event payment" });
  }
};
const cancelSpecialEventPayment = async (req, res) => {
  try {
    const { txRef, status } = req.body;
    if (!txRef || status !== "cancelled" && status !== "failed") return res.status(400).json({ error: "Event payment outcome is invalid" });
    const attempt = await getPaymentAttemptAsService(txRef);
    const booking = await getBooking$1(attempt.booking_id, req.headers.authorization);
    await assertEventBookingTenant(req, booking);
    if (attempt.status === "successful" || attempt.status === "manual_review") {
      return res.json({ bookingId: attempt.booking_id, paymentStatus: attempt.status });
    }
    if (attempt.status === "initiated" || attempt.status === "redirected") {
      await updatePaymentAttempt(txRef, status === "cancelled" ? { status, cancelled_at: (/* @__PURE__ */ new Date()).toISOString() } : { status, failure_reason: "Flutterwave returned an unsuccessful payment status" });
    }
    return res.json({ bookingId: attempt.booking_id, paymentStatus: status });
  } catch (error) {
    return res.status(error instanceof SpecialEventPaymentError ? error.status : 400).json({ error: error instanceof Error ? error.message : "Unable to record event payment cancellation" });
  }
};
const handleSpecialEventWebhook = async (req, res) => {
  const { secretHash } = getConfiguration$2();
  if (!secretHash) {
    console.error("Special event webhook secret is not configured");
    return res.status(503).end();
  }
  if (req.headers["verif-hash"] !== secretHash) return res.status(401).end();
  const payload = req.body;
  if (payload.event !== "charge.completed" || !payload.data?.id || !payload.data.tx_ref) return res.status(200).end();
  try {
    const attempt = await getPaymentAttemptAsService(payload.data.tx_ref);
    const booking = await getBookingAsService(attempt.booking_id);
    const transaction = await verifyTransaction$1(String(payload.data.id));
    assertTransactionMatches(transaction, attempt, booking);
    if (attempt.status !== "successful" && attempt.status !== "manual_review") {
      await updatePaymentAttempt(payload.data.tx_ref, { transaction_id: String(transaction.id), status: "verified" });
    }
    await confirmBookingAsService(booking.id, String(transaction.id));
    return res.status(200).end();
  } catch (error) {
    console.error("Special event webhook processing error", error);
    return res.status(500).end();
  }
};
const paymentBaseUrl = "https://api.flutterwave.com/v3";
const supportedCurrencies$1 = /* @__PURE__ */ new Set(["USD", "UGX", "EUR", "GBP", "KES", "TZS", "RWF"]);
const configuration$2 = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) throw new Error("Hotel spa database configuration is incomplete");
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), supabaseAnonKey, serviceRoleKey };
};
const serviceHeaders$2 = (json = false) => {
  const { supabaseAnonKey, serviceRoleKey } = configuration$2();
  return { apikey: supabaseAnonKey, Authorization: `Bearer ${serviceRoleKey}`, ...json ? { "content-type": "application/json" } : {} };
};
const readService$2 = async (path2) => {
  const { supabaseUrl } = configuration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path2}`, { headers: serviceHeaders$2(), signal: AbortSignal.timeout(1e4) });
  if (!response.ok) throw new Error("Hotel spa data could not be loaded");
  return response.json();
};
const writeService$1 = async (path2, method, body) => {
  const { supabaseUrl } = configuration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path2}`, {
    method,
    headers: { ...serviceHeaders$2(true), Prefer: "return=representation" },
    ...body ? { body: JSON.stringify(body) } : {},
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) throw new Error("Spa service could not be saved");
  if (response.status === 204) return [];
  return response.json();
};
const callRpc = async (name, args) => {
  const { supabaseUrl } = configuration$2();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders$2(true),
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(15e3)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(typeof result === "object" && result && "message" in result ? result.message : "Spa request could not be completed"), { status: 400 });
  return result;
};
const getUserId = async (authorization) => {
  if (!authorization?.startsWith("Bearer ")) throw Object.assign(new Error("Authentication is required"), { status: 401 });
  const { supabaseUrl, supabaseAnonKey } = configuration$2();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseAnonKey, Authorization: authorization }, signal: AbortSignal.timeout(1e4) });
  if (!response.ok) throw Object.assign(new Error("Your sign-in session has expired"), { status: 401 });
  const user = await response.json();
  if (!user.id) throw Object.assign(new Error("Your sign-in session could not be verified"), { status: 401 });
  return user.id;
};
const requireHotelManager = async (request) => {
  const tenant = await resolveRequestHotelTenant(request);
  const userId = await getUserId(request.headers.authorization);
  const organizationId = encodeURIComponent(tenant.organizationId);
  const encodedUserId = encodeURIComponent(userId);
  const [profiles, memberships] = await Promise.all([
    readService$2(`user_profiles?user_id=eq.${encodedUserId}&select=role&limit=1`),
    readService$2(`books_memberships?organization_id=eq.${organizationId}&user_id=eq.${encodedUserId}&role=in.(owner,admin)&select=role&limit=1`)
  ]);
  if (profiles[0]?.role !== "manager" || !memberships[0]) throw Object.assign(new Error("Only a hotel manager can manage spa services"), { status: 403 });
  return tenant;
};
const validEmail = (value) => typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const parseWeeklyHours = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Set valid weekly opening hours");
  const output = {};
  for (let day = 0; day < 7; day += 1) {
    const ranges = value[String(day)];
    if (!Array.isArray(ranges) || ranges.length > 8) throw new Error("Set valid weekly opening hours");
    const parsed = ranges.map((range) => {
      if (!range || typeof range !== "object") throw new Error("Set valid weekly opening hours");
      const { open, close } = range;
      if (typeof open !== "string" || typeof close !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(close) || close <= open) {
        throw new Error("Opening ranges must have a start and a later closing time on the same day");
      }
      return { open, close };
    }).sort((a, b) => a.open.localeCompare(b.open));
    if (parsed.some((range, index) => index > 0 && range.open < parsed[index - 1].close)) throw new Error("Opening ranges cannot overlap");
    output[String(day)] = parsed;
  }
  return output;
};
const validateService = (input) => {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const price = Number(input.price);
  const currencyCode = typeof input.currency_code === "string" ? input.currency_code.trim().toUpperCase() : "";
  const durationMinutes = Number(input.duration_minutes);
  const slotIntervalMinutes = Number(input.slot_interval_minutes);
  const capacity = Number(input.capacity);
  const depositType = input.deposit_type;
  const depositValue = Number(input.deposit_value);
  const timezone = typeof input.timezone === "string" ? input.timezone.trim() : "Africa/Kampala";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new Error("Enter a valid hotel timezone");
  }
  if (!name || name.length > 120 || description.length > 2e3 || !Number.isFinite(price) || price <= 0 || !supportedCurrencies$1.has(currencyCode) || !Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 480 || !Number.isInteger(slotIntervalMinutes) || slotIntervalMinutes < 5 || slotIntervalMinutes > 240 || !Number.isInteger(capacity) || capacity < 1 || capacity > 100 || depositType !== "fixed" && depositType !== "percentage" || !Number.isFinite(depositValue) || depositValue < 0 || depositValue <= 0 || depositType === "percentage" && depositValue > 100 || depositType === "fixed" && depositValue > price) {
    throw new Error("Enter valid spa service details");
  }
  return { name, description, price, currency_code: currencyCode, duration_minutes: durationMinutes, slot_interval_minutes: slotIntervalMinutes, capacity, weekly_hours: parseWeeklyHours(input.weekly_hours), deposit_type: depositType, deposit_value: depositValue, is_active: input.is_active === true };
};
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const safeText$1 = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const getIp = (request) => {
  const forwarded = request.headers["x-vercel-forwarded-for"] || request.headers["x-nf-client-connection-ip"];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() || request.ip || request.socket.remoteAddress || "unknown";
};
const returnUrl = (domain) => {
  const value = process.env.FLUTTERWAVE_RETURN_URL;
  if (!value) throw new Error("Flutterwave return URL is not configured");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" || parsed.pathname !== "/checkout/flutterwave-return") throw new Error("Flutterwave return URL must use HTTPS and target the payment return route");
  parsed.hostname = domain;
  return parsed.toString();
};
const getHotelSpaServices = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const organizationId = encodeURIComponent(tenant.organizationId);
    const [settings, services] = await Promise.all([
      readService$2(`hotel_tenant_settings?organization_id=eq.${organizationId}&is_active=eq.true&select=timezone&limit=1`),
      readService$2(`hotel_spa_services?organization_id=eq.${organizationId}&is_active=eq.true&select=id,name,description,price,currency_code,duration_minutes,slot_interval_minutes,capacity,weekly_hours,deposit_type,deposit_value&order=name.asc`)
    ]);
    response.setHeader("Cache-Control", "private, no-store");
    response.json({ tenant: { name: tenant.name, timezone: settings[0]?.timezone || "Africa/Kampala" }, services });
  } catch (error) {
    response.status(error.status || 404).json({ error: error instanceof Error ? error.message : "Spa services could not be loaded" });
  }
};
const getHotelSpaAvailability = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const serviceId = request.query.serviceId;
    const date = request.query.date;
    if (typeof serviceId !== "string" || !/^[0-9a-f-]{36}$/i.test(serviceId) || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return response.status(400).json({ error: "Choose a spa service and appointment date" });
    }
    const slots = await callRpc("get_hotel_spa_availability", {
      target_organization_id: tenant.organizationId,
      target_service_id: serviceId,
      target_date: date
    });
    response.setHeader("Cache-Control", "private, no-store");
    response.json({ slots });
  } catch (error) {
    response.status(error.status || 503).json({ error: error instanceof Error ? error.message : "Spa availability could not be loaded" });
  }
};
const getHotelSpaServicesForManagement = async (request, response) => {
  try {
    const tenant = await requireHotelManager(request);
    const [services, settings] = await Promise.all([
      readService$2(`hotel_spa_services?organization_id=eq.${encodeURIComponent(tenant.organizationId)}&select=*&order=name.asc`),
      readService$2(`hotel_tenant_settings?organization_id=eq.${encodeURIComponent(tenant.organizationId)}&select=timezone&limit=1`)
    ]);
    response.setHeader("Cache-Control", "private, no-store");
    response.json({ services, timezone: settings[0]?.timezone || "Africa/Kampala" });
  } catch (error) {
    response.status(error.status || 503).json({ error: error instanceof Error ? error.message : "Spa services could not be loaded" });
  }
};
const saveHotelSpaService = async (request, response) => {
  try {
    const tenant = await requireHotelManager(request);
    const body = request.body;
    const values = validateService(body);
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "Africa/Kampala";
    await writeService$1(`hotel_tenant_settings?organization_id=eq.${encodeURIComponent(tenant.organizationId)}`, "PATCH", { timezone, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    if (typeof body.id === "string") {
      const rows = await writeService$1(`hotel_spa_services?id=eq.${encodeURIComponent(body.id)}&organization_id=eq.${encodeURIComponent(tenant.organizationId)}&select=id`, "PATCH", values);
      if (!rows.length) return response.status(404).json({ error: "Spa service was not found for this hotel" });
    } else {
      await writeService$1("hotel_spa_services?select=id", "POST", { ...values, organization_id: tenant.organizationId });
    }
    return response.json({ ok: true });
  } catch (error) {
    return response.status(error.status || 400).json({ error: error instanceof Error ? error.message : "Spa service could not be saved" });
  }
};
const deleteHotelSpaService = async (request, response) => {
  try {
    const tenant = await requireHotelManager(request);
    const id = request.body.id;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return response.status(400).json({ error: "Spa service identifier is invalid" });
    const rows = await writeService$1(`hotel_spa_services?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(tenant.organizationId)}&select=id`, "DELETE");
    if (!rows.length) return response.status(404).json({ error: "Spa service was not found for this hotel" });
    return response.json({ ok: true });
  } catch (error) {
    return response.status(error.status || 503).json({ error: error instanceof Error ? error.message : "Spa service could not be deleted" });
  }
};
const createHotelSpaBooking = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const body = request.body;
    const guest = body.guest && typeof body.guest === "object" ? body.guest : {};
    const firstName = safeText$1(guest.firstName, 100);
    const lastName = safeText$1(guest.lastName, 100);
    const email = safeText$1(guest.email, 254).toLowerCase();
    const phone = safeText$1(guest.phone, 40);
    if (!firstName || !lastName || !validEmail(email) || !phone || typeof body.serviceId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.serviceId) || typeof body.slotStart !== "string" || Number.isNaN(Date.parse(body.slotStart)) || !["pay_at_spa", "full", "deposit"].includes(String(body.paymentChoice))) {
      return response.status(400).json({ error: "Enter your contact details and choose a spa service, time, and payment option" });
    }
    const forwardedAddress = getIp(request);
    const { supabaseUrl } = configuration$2();
    const rateKey = createHash("sha256").update(`spa:${tenant.organizationId}:${forwardedAddress}`).digest("hex");
    const limitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_hotel_booking_rate_limit`, {
      method: "POST",
      headers: serviceHeaders$2(true),
      body: JSON.stringify({ target_rate_limit_key: rateKey }),
      signal: AbortSignal.timeout(1e4)
    });
    if (!limitResponse.ok || !await limitResponse.json()) return response.status(429).json({ error: "Too many appointment attempts. Please try again later." });
    const accessToken = randomBytes(32).toString("hex");
    const booking = await callRpc("create_hotel_spa_booking", {
      target_organization_id: tenant.organizationId,
      target_service_id: body.serviceId,
      target_guest: { first_name: firstName, last_name: lastName, email, phone },
      target_slot_start: new Date(body.slotStart).toISOString(),
      target_payment_choice: body.paymentChoice,
      target_access_token_hash: hashToken(accessToken)
    });
    const result = booking[0];
    if (!result) throw new Error("Spa booking was not created");
    response.status(201).json({ ...result, accessToken });
  } catch (error) {
    response.status(error.status || 400).json({ error: error instanceof Error ? error.message : "Spa booking could not be created" });
  }
};
const getSpaBooking = async (bookingId, accessToken) => {
  const rows = await readService$2(`hotel_spa_bookings?id=eq.${encodeURIComponent(bookingId)}&access_token_hash=eq.${hashToken(accessToken)}&select=*`);
  if (!rows[0]) throw Object.assign(new Error("Spa booking could not be verified"), { status: 404 });
  return rows[0];
};
const verifyFlutterwaveTransaction = async (transactionId) => {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) throw new Error("Flutterwave payment configuration is incomplete");
  const response = await fetch(`${paymentBaseUrl}/transactions/${encodeURIComponent(transactionId)}/verify`, { headers: { Authorization: `Bearer ${secretKey}` }, signal: AbortSignal.timeout(15e3) });
  const payload = await response.json();
  if (!response.ok || payload.status !== "success" || !payload.data) throw new Error("Spa payment could not be verified");
  return payload.data;
};
const confirmSpaPayment = async (transactionId, txRef, booking) => {
  const transaction = await verifyFlutterwaveTransaction(transactionId);
  const { supabaseUrl } = configuration$2();
  const attempts = await readService$2(`hotel_spa_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}&booking_id=eq.${encodeURIComponent(String(booking.id))}&select=*`);
  const attempt = attempts[0];
  if (!attempt || transaction.status !== "successful" || transaction.tx_ref !== txRef || Number(transaction.amount) !== Number(attempt.amount) || Number(transaction.amount) !== Number(booking.amount_due) || transaction.currency?.toUpperCase() !== String(booking.currency_code).trim().toUpperCase()) {
    throw new Error("Spa payment details do not match the booking");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/confirm_hotel_spa_booking_payment`, {
    method: "POST",
    headers: serviceHeaders$2(true),
    body: JSON.stringify({ target_booking_id: booking.id, target_access_token_hash: booking.access_token_hash, target_tx_ref: txRef, target_transaction_id: String(transaction.id) }),
    signal: AbortSignal.timeout(15e3)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Hotel spa payment confirmation RPC failed", { bookingId: booking.id, txRef, error: result?.message || response.status });
    throw new Error("Spa payment could not be confirmed");
  }
  return Array.isArray(result) ? result[0] : result;
};
const createHotelSpaPaymentSession = async (request, response) => {
  let txRef;
  try {
    const { bookingId, accessToken } = request.body;
    if (typeof bookingId !== "string" || typeof accessToken !== "string" || !/^[a-f0-9]{64}$/i.test(accessToken)) return response.status(400).json({ error: "Spa booking access is invalid" });
    const booking = await getSpaBooking(bookingId, accessToken);
    const tenant = await resolveRequestHotelTenant(request);
    if (booking.organization_id !== tenant.organizationId) return response.status(404).json({ error: "Spa booking could not be verified" });
    if (booking.booking_status !== "pending_payment" || new Date(String(booking.expires_at)).getTime() <= Date.now()) return response.status(409).json({ error: "Spa booking hold has expired" });
    const paymentOptions = String(booking.currency_code).trim().toUpperCase() === "UGX" ? "card, mobilemoneyuganda" : "card";
    txRef = `hotel-spa-${String(booking.confirmation_number)}-${randomUUID()}`;
    const attemptRows = await callRpc("create_hotel_spa_payment_attempt", {
      target_booking_id: booking.id,
      target_access_token_hash: hashToken(accessToken),
      target_tx_ref: txRef
    });
    const attempt = attemptRows[0];
    if (attempt?.attempt_status === "redirected" && attempt.attempt_payment_url) return response.json({ paymentUrl: attempt.attempt_payment_url, txRef: attempt.attempt_tx_ref, bookingId });
    txRef = attempt?.attempt_tx_ref;
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey || !txRef) throw new Error("Spa payment configuration is incomplete");
    const paymentResponse = await fetch(`${paymentBaseUrl}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: Number(attempt.amount),
        currency: String(attempt.currency_code).trim().toUpperCase(),
        payment_options: paymentOptions,
        redirect_url: returnUrl(request.hostname),
        customer: { email: booking.guest_email, name: `${booking.guest_first_name} ${booking.guest_last_name}`.trim(), phonenumber: booking.guest_phone },
        meta: { booking_id: booking.id, confirmation_number: booking.confirmation_number, flow: "hotel-spa" },
        customizations: { title: `${tenant.name} Spa`, description: `Spa appointment ${booking.confirmation_number}` }
      }),
      signal: AbortSignal.timeout(15e3)
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.status !== "success" || !payment.data?.link) throw new Error("Flutterwave could not prepare spa checkout");
    await writeService$1(`hotel_spa_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}`, "PATCH", { status: "redirected", payment_url: payment.data.link, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    return response.json({ paymentUrl: payment.data.link, txRef, bookingId });
  } catch (error) {
    if (txRef) await writeService$1(`hotel_spa_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}`, "PATCH", { status: "failed", updated_at: (/* @__PURE__ */ new Date()).toISOString() }).catch(() => void 0);
    return response.status(error.status || 502).json({ error: error instanceof Error ? error.message : "Spa payment could not be prepared" });
  }
};
const verifyHotelSpaPayment = async (request, response) => {
  try {
    const { transactionId, txRef, accessToken, bookingId } = request.body;
    if (!transactionId || typeof txRef !== "string" || typeof accessToken !== "string" || typeof bookingId !== "string") return response.status(400).json({ error: "Spa payment verification details are required" });
    const booking = await getSpaBooking(bookingId, accessToken);
    const tenant = await resolveRequestHotelTenant(request);
    if (booking.organization_id !== tenant.organizationId) return response.status(404).json({ error: "Spa booking could not be verified" });
    const confirmation = await confirmSpaPayment(String(transactionId), txRef, booking);
    return response.json(confirmation);
  } catch (error) {
    console.error("Hotel spa payment verification failed", { txRef: request.body.txRef, error: error instanceof Error ? error.message : "unknown error" });
    return response.status(error.status || 400).json({ error: error instanceof Error ? error.message : "Spa payment could not be verified" });
  }
};
const cancelHotelSpaPayment = async (request, response) => {
  try {
    const { txRef, status, accessToken } = request.body;
    if (typeof txRef !== "string" || !["cancelled", "failed"].includes(String(status)) || typeof accessToken !== "string") return response.status(400).json({ error: "Spa payment status is invalid" });
    const attempts = await readService$2(`hotel_spa_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}&select=*`);
    const attempt = attempts[0];
    if (!attempt) return response.status(404).json({ error: "Spa payment attempt was not found" });
    const booking = await getSpaBooking(String(attempt.booking_id), accessToken);
    const tenant = await resolveRequestHotelTenant(request);
    if (booking.organization_id !== tenant.organizationId) return response.status(404).json({ error: "Spa payment attempt was not found" });
    if (["initiated", "redirected"].includes(String(attempt.status))) await writeService$1(`hotel_spa_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}`, "PATCH", { status, updated_at: (/* @__PURE__ */ new Date()).toISOString() });
    return response.json({ ok: true });
  } catch (error) {
    return response.status(error.status || 400).json({ error: error instanceof Error ? error.message : "Spa payment status could not be saved" });
  }
};
const verifyHotelSpaPaymentForWebhook = async (transactionId, txRef) => {
  const attempts = await readService$2(`hotel_spa_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}&select=booking_id`);
  if (!attempts[0]) throw new Error("Spa payment attempt was not found");
  const bookings = await readService$2(`hotel_spa_bookings?id=eq.${encodeURIComponent(String(attempts[0].booking_id))}&select=*`);
  if (!bookings[0]) throw new Error("Spa booking was not found");
  return confirmSpaPayment(transactionId, txRef, bookings[0]);
};
const flutterwaveBaseUrl = "https://api.flutterwave.com/v3";
const supportedCurrencies = /* @__PURE__ */ new Set(["USD", "UGX", "EUR", "GBP", "KES", "TZS", "RWF"]);
const fxProvider = "open.er-api.com";
class HotelBookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const configuration$1 = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error("Hotel booking database configuration is incomplete");
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), supabaseAnonKey, serviceRoleKey };
};
const serviceHeaders$1 = (json = false) => {
  const { supabaseAnonKey, serviceRoleKey } = configuration$1();
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...json ? { "content-type": "application/json" } : {}
  };
};
const readService$1 = async (path2) => {
  const { supabaseUrl } = configuration$1();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path2}`, { headers: serviceHeaders$1() });
  if (!response.ok) throw new Error("Unable to read hotel booking data");
  return response.json();
};
const writeService = async (path2, method, body, prefer = "return=minimal") => {
  const { supabaseUrl } = configuration$1();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path2}`, {
    method,
    headers: { ...serviceHeaders$1(true), Prefer: prefer },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error("Unable to save hotel booking data");
  return response;
};
const callServiceRpc$1 = async (name, args) => {
  const { supabaseUrl } = configuration$1();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...serviceHeaders$1(true), Prefer: "return=representation" },
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.message === "string" ? payload.message : "Unable to create hotel reservation";
    throw new HotelBookingError(message, response.status >= 500 ? 503 : 400);
  }
  return payload;
};
const fetchAndStoreRates = async () => {
  const cached = await readService$1(
    "books_fx_rates?base_currency=eq.UGX&select=quote_currency,rate,fetched_at,stored_at,provider&order=stored_at.desc"
  );
  const currentTime = Date.now();
  const mostRecent = cached[0]?.stored_at ? new Date(cached[0].stored_at).getTime() : 0;
  const fetchedAt = cached[0]?.fetched_at ? new Date(cached[0].fetched_at).getTime() : 0;
  const cachedRates = Object.fromEntries(cached.map((row) => [row.quote_currency.trim(), Number(row.rate)]));
  const cachedSnapshotIsUsable = cached.length >= supportedCurrencies.size - 1 && currentTime - mostRecent < 30 * 60 * 1e3 && mostRecent <= currentTime + 5 * 60 * 1e3 && currentTime - fetchedAt <= 36 * 60 * 60 * 1e3 && fetchedAt <= currentTime + 5 * 60 * 1e3 && cached.every((row) => row.provider === fxProvider && new Date(row.fetched_at).getTime() === fetchedAt && currentTime - new Date(row.stored_at).getTime() < 30 * 60 * 1e3 && new Date(row.stored_at).getTime() <= currentTime + 5 * 60 * 1e3 && Number.isFinite(Number(row.rate)) && Number(row.rate) > 0) && [...supportedCurrencies].filter((currency) => currency !== "UGX").every((currency) => Number.isFinite(cachedRates[currency]) && cachedRates[currency] > 0);
  if (cachedSnapshotIsUsable) {
    return { rates: { UGX: 1, ...cachedRates }, asOf: cached[0].fetched_at, provider: cached[0].provider };
  }
  const response = await fetch("https://open.er-api.com/v6/latest/UGX", { signal: AbortSignal.timeout(8e3) });
  const payload = await response.json();
  if (!response.ok || payload.result !== "success" || !payload.rates || !payload.time_last_update_unix) {
    throw new Error("The exchange-rate service is temporarily unavailable");
  }
  const asOfDate = new Date(payload.time_last_update_unix * 1e3);
  if (Date.now() - asOfDate.getTime() > 36 * 60 * 60 * 1e3 || asOfDate.getTime() > Date.now() + 5 * 60 * 1e3) {
    throw new Error("The exchange-rate service returned an outdated snapshot");
  }
  const asOf = asOfDate.toISOString();
  const rates = { ...payload.rates, UGX: 1 };
  const rows = [...supportedCurrencies].filter((currency) => currency !== "UGX" && Number.isFinite(rates[currency]) && rates[currency] > 0).map((currency) => ({ base_currency: "UGX", quote_currency: currency, rate: rates[currency], provider: fxProvider, fetched_at: asOf, stored_at: (/* @__PURE__ */ new Date()).toISOString() }));
  if (rows.length !== supportedCurrencies.size - 1) throw new Error("The exchange-rate service is missing a supported hotel currency");
  await writeService("books_fx_rates?on_conflict=base_currency,quote_currency", "POST", rows, "resolution=merge-duplicates,return=minimal");
  return { rates, asOf, provider: fxProvider };
};
const safeText = (value, maxLength) => typeof value === "string" ? value.trim().slice(0, maxLength) : "";
const resolveAuthenticatedUserId = async (authorization) => {
  if (!authorization) return null;
  if (!authorization.startsWith("Bearer ")) throw new HotelBookingError("Your sign-in session is invalid", 401);
  const { supabaseUrl, supabaseAnonKey } = configuration$1();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseAnonKey, Authorization: authorization } });
  if (!response.ok) throw new HotelBookingError("Your sign-in session has expired. Sign in again and retry.", 401);
  const user = await response.json();
  if (!user.id) throw new HotelBookingError("Your sign-in session could not be verified", 401);
  return user.id;
};
const getBooking = async (bookingId) => {
  const rows = await readService$1(`hotel_bookings?id=eq.${encodeURIComponent(bookingId)}&select=*`);
  if (!rows[0]) throw new HotelBookingError("Hotel reservation was not found", 404);
  return rows[0];
};
const assertBookingTenant = async (request, booking) => {
  const tenant = await resolveRequestHotelTenant(request);
  if (booking.organization_id !== tenant.organizationId) {
    throw new HotelBookingError("This reservation is not available for this hotel", 404);
  }
  return tenant;
};
const getAttempt = async (txRef) => {
  const rows = await readService$1(`hotel_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}&select=*`);
  if (!rows[0]) throw new HotelBookingError("Payment attempt was not found", 404);
  return rows[0];
};
const getReturnUrl = (domain) => {
  const configuredUrl = process.env.FLUTTERWAVE_RETURN_URL;
  if (!configuredUrl) throw new Error("Flutterwave return URL is not configured");
  const url = new URL(configuredUrl);
  if (url.protocol !== "https:" || url.pathname !== "/checkout/flutterwave-return") {
    throw new Error("Flutterwave return URL must use HTTPS and target the payment return route");
  }
  url.hostname = domain;
  url.searchParams.set("flow", "hotel");
  return url.toString();
};
const createBooking = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const body = request.body;
    const userId = await resolveAuthenticatedUserId(request.headers.authorization);
    const email = safeText(body.guest?.email, 254).toLowerCase();
    const forwardedAddress = request.headers["x-vercel-forwarded-for"] || request.headers["x-nf-client-connection-ip"];
    const clientAddress = (Array.isArray(forwardedAddress) ? forwardedAddress[0] : forwardedAddress)?.split(",")[0]?.trim() || request.ip || request.socket.remoteAddress || "unknown";
    const rateLimitKey = createHash("sha256").update(clientAddress).digest("hex");
    if (!body.roomId || !/^[0-9a-f-]{36}$/i.test(body.roomId)) throw new HotelBookingError("Select a valid room");
    if (!body.checkIn || !/^\d{4}-\d{2}-\d{2}$/.test(body.checkIn) || !body.checkOut || !/^\d{4}-\d{2}-\d{2}$/.test(body.checkOut)) throw new HotelBookingError("Select valid check-in and check-out dates");
    if (!body.idempotencyKey || !/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)) throw new HotelBookingError("Booking request is invalid");
    if (!body.accessToken || body.accessToken.length < 32 || body.accessToken.length > 256) throw new HotelBookingError("Booking access credential is invalid");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isInteger(body.guestCount) || !Number.isInteger(body.roomCount)) throw new HotelBookingError("Enter valid guest and room details");
    if (!Array.isArray(body.preferences) || body.preferences.some((value) => typeof value !== "string")) throw new HotelBookingError("Room preferences are invalid");
    const accessTokenHash = createHash("sha256").update(body.accessToken).digest("hex");
    const bookingWithKey = (await readService$1(
      `hotel_bookings?idempotency_key=eq.${encodeURIComponent(body.idempotencyKey)}&select=organization_id,user_id,access_token_hash,fx_rates_snapshot&limit=1`
    ))[0];
    if (bookingWithKey && bookingWithKey.organization_id !== tenant.organizationId) {
      throw new HotelBookingError("Reservation belongs to a different hotel", 404);
    }
    const existingBooking = bookingWithKey?.user_id === userId && bookingWithKey.access_token_hash === accessTokenHash ? bookingWithKey : null;
    let ratesSnapshot = null;
    if (!existingBooking) {
      const rateLimitAllowed = await callServiceRpc$1("consume_hotel_booking_rate_limit", { target_rate_limit_key: rateLimitKey });
      if (!rateLimitAllowed) throw new HotelBookingError("Too many reservation attempts. Please try again later", 429);
      ratesSnapshot = await fetchAndStoreRates();
      const selectedRoom = (await readService$1(`hotel_rooms?id=eq.${encodeURIComponent(body.roomId)}&organization_id=eq.${encodeURIComponent(tenant.organizationId)}&status=eq.published&select=currency_code`))[0];
      if (!selectedRoom) throw new HotelBookingError("This room is not available for booking", 404);
      const currency = selectedRoom.currency_code.trim().toUpperCase();
      if (!supportedCurrencies.has(currency) || !ratesSnapshot.rates[currency]) throw new HotelBookingError("This room uses an unsupported booking currency");
    }
    await callServiceRpc$1("release_expired_hotel_offer_holds_for_tenant", {
      target_organization_id: tenant.organizationId
    });
    const rows = await callServiceRpc$1(
      "create_hotel_booking_for_tenant",
      {
        target_organization_id: tenant.organizationId,
        target_room_id: body.roomId,
        target_guest: {
          first_name: safeText(body.guest?.firstName, 100),
          last_name: safeText(body.guest?.lastName, 100),
          email,
          phone: safeText(body.guest?.phone, 40),
          promo_code: safeText(body.guest?.promoCode, 50).toUpperCase(),
          business_purchase: body.guest?.businessPurchase === true,
          buyer_tax_id: safeText(body.guest?.buyerTaxId, 30)
        },
        target_check_in: body.checkIn,
        target_check_out: body.checkOut,
        target_guest_count: body.guestCount,
        target_room_count: body.roomCount,
        target_special_requests: safeText(body.specialRequests, 2e3),
        target_preferences: body.preferences,
        target_user_id: userId,
        target_idempotency_key: body.idempotencyKey,
        target_access_token_hash: accessTokenHash,
        target_fx_rates: ratesSnapshot ? { ...ratesSnapshot.rates, as_of: ratesSnapshot.asOf, provider: ratesSnapshot.provider } : null
      }
    );
    const booking = rows[0];
    if (!booking) throw new Error("Reservation was not returned after creation");
    response.json({
      ...booking,
      accessToken: body.accessToken,
      fxAsOf: ratesSnapshot?.asOf ?? existingBooking?.fx_rates_snapshot?.as_of ?? null
    });
  } catch (error) {
    response.status(error instanceof HotelBookingError ? error.status : 503).json({
      error: error instanceof Error ? error.message : "Unable to create hotel reservation"
    });
  }
};
const createPaymentSession = async (request, response) => {
  let txRef;
  try {
    const { bookingId, accessToken } = request.body;
    if (!bookingId || !accessToken) throw new HotelBookingError("Booking access is required");
    const booking = await getBooking(bookingId);
    const tenant = await assertBookingTenant(request, booking);
    const tokenHash = createHash("sha256").update(accessToken).digest("hex");
    if (tokenHash !== booking.access_token_hash) throw new HotelBookingError("Booking access could not be verified", 403);
    if (booking.payment_status === "paid") throw new HotelBookingError("This reservation is already paid", 409);
    if (booking.booking_status !== "pending" || !booking.expires_at || new Date(booking.expires_at).getTime() <= Date.now()) {
      throw new HotelBookingError("This reservation hold has expired. Select the room again to start a new booking.", 409);
    }
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) throw new Error("Flutterwave payment configuration is incomplete");
    const requestedTxRef = `hotel-${booking.confirmation_number}-${randomUUID()}`;
    const attempts = await callServiceRpc$1(
      "create_hotel_payment_attempt",
      {
        target_booking_id: booking.id,
        target_access_token_hash: tokenHash,
        target_tx_ref: requestedTxRef
      }
    );
    const active = attempts[0];
    if (!active) throw new Error("Payment attempt was not returned after creation");
    if (active.attempt_status === "redirected" && active.attempt_payment_url) {
      response.json({ paymentUrl: active.attempt_payment_url, txRef: active.attempt_tx_ref, bookingId: booking.id });
      return;
    }
    if (active.attempt_status === "preparing") {
      throw new HotelBookingError("Secure checkout is already being prepared. Try again shortly.", 409);
    }
    txRef = active.attempt_tx_ref;
    const currency = booking.currency_code.trim().toUpperCase();
    const flutterwaveResponse = await fetch(`${flutterwaveBaseUrl}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: Number(booking.total_amount),
        currency,
        payment_options: currency === "UGX" ? "card, mobilemoneyuganda" : "card",
        redirect_url: getReturnUrl(tenant.domain),
        customer: {
          email: booking.guest_email,
          name: `${booking.guest_first_name} ${booking.guest_last_name}`.trim(),
          phonenumber: booking.guest_phone
        },
        meta: { booking_id: booking.id, confirmation_number: booking.confirmation_number },
        customizations: { title: "Hotel Room Reservation", description: `Reservation ${booking.confirmation_number}` }
      }),
      signal: AbortSignal.timeout(15e3)
    });
    const payload = await flutterwaveResponse.json();
    if (!flutterwaveResponse.ok || payload.status !== "success" || !payload.data?.link) {
      throw new HotelBookingError("Flutterwave could not prepare secure checkout. Please try again.", 502);
    }
    await writeService(`hotel_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}`, "PATCH", { status: "redirected", payment_url: payload.data.link });
    response.json({ paymentUrl: payload.data.link, txRef, bookingId: booking.id });
  } catch (error) {
    if (txRef) {
      await writeService(`hotel_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}`, "PATCH", {
        status: "failed",
        failure_reason: error instanceof Error ? error.message.slice(0, 500) : "Unable to prepare payment"
      }).catch((failure) => console.error("Unable to record hotel payment failure", failure));
    }
    response.status(error instanceof HotelBookingError ? error.status : 503).json({
      error: error instanceof Error ? error.message : "Unable to prepare hotel payment"
    });
  }
};
const verifyTransaction = async (transactionId) => {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secretKey) throw new Error("Flutterwave payment configuration is incomplete");
  const response = await fetch(`${flutterwaveBaseUrl}/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(15e3)
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== "success" || !payload.data) throw new Error("Hotel payment could not be verified");
  return payload.data;
};
const verifyHotelPayment = async (transactionId, txRef, accessToken, tenantOrganizationId) => {
  const attempt = await getAttempt(txRef);
  const booking = await getBooking(attempt.booking_id);
  if (tenantOrganizationId && booking.organization_id !== tenantOrganizationId) {
    throw new HotelBookingError("This reservation is not available for this hotel", 404);
  }
  if (accessToken && createHash("sha256").update(accessToken).digest("hex") !== booking.access_token_hash) {
    throw new HotelBookingError("Booking access could not be verified", 403);
  }
  const transaction = await verifyTransaction(transactionId);
  if (transaction.status !== "successful" || transaction.tx_ref !== attempt.tx_ref || Number(transaction.amount) !== Number(booking.total_amount) || Number(transaction.amount) !== Number(attempt.amount) || transaction.currency.toUpperCase() !== booking.currency_code.trim().toUpperCase() || transaction.currency.toUpperCase() !== attempt.currency_code.trim().toUpperCase() || transaction.meta?.booking_id !== booking.id) throw new HotelBookingError("Payment verification did not match this reservation", 409);
  const result = await callServiceRpc$1(
    "confirm_hotel_booking_payment",
    { target_tx_ref: txRef, target_transaction_id: String(transaction.id) }
  );
  const confirmation = result[0];
  if (!confirmation) throw new Error("Confirmed hotel reservation was not returned");
  return confirmation;
};
const createHotelBooking = createBooking;
const createHotelPaymentSession = createPaymentSession;
const recoverHotelBooking = async (request, response) => {
  try {
    const { bookingId, accessToken } = request.body;
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId) || !accessToken || accessToken.length < 32 || accessToken.length > 256) {
      throw new HotelBookingError("Booking recovery details are invalid");
    }
    const booking = await getBooking(bookingId);
    await assertBookingTenant(request, booking);
    if (createHash("sha256").update(accessToken).digest("hex") !== booking.access_token_hash) {
      throw new HotelBookingError("Booking access could not be verified", 403);
    }
    response.json({
      bookingId: booking.id,
      confirmationNumber: booking.confirmation_number,
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
      currencyCode: booking.currency_code.trim(),
      totalAmount: Number(booking.total_amount),
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: Number(booking.nights),
      expiresAt: booking.expires_at
    });
  } catch (error) {
    response.status(error instanceof HotelBookingError ? error.status : 503).json({
      error: error instanceof Error ? error.message : "Unable to retrieve this reservation"
    });
  }
};
const cancelHotelBookingHold = async (request, response) => {
  try {
    const { bookingId, accessToken } = request.body;
    if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId) || !accessToken || accessToken.length < 32 || accessToken.length > 256) {
      throw new HotelBookingError("Booking cancellation details are invalid");
    }
    const booking = await getBooking(bookingId);
    await assertBookingTenant(request, booking);
    const tokenHash = createHash("sha256").update(accessToken).digest("hex");
    if (tokenHash !== booking.access_token_hash) throw new HotelBookingError("Booking access could not be verified", 403);
    const cancelled = await callServiceRpc$1("cancel_hotel_booking_hold", {
      target_booking_id: bookingId,
      target_access_token_hash: tokenHash
    });
    response.json({ cancelled });
  } catch (error) {
    response.status(error instanceof HotelBookingError ? error.status : 503).json({
      error: error instanceof Error ? error.message : "Unable to release reservation hold"
    });
  }
};
const verifyHotelBookingPayment = async (request, response) => {
  try {
    const { transactionId, txRef, accessToken } = request.body;
    if (!transactionId || !txRef?.startsWith("hotel-") || !accessToken) throw new HotelBookingError("Payment verification details are required");
    const tenant = await resolveRequestHotelTenant(request);
    const confirmation = await verifyHotelPayment(String(transactionId), txRef, accessToken, tenant.organizationId);
    response.json({ ...confirmation, paymentStatus: confirmation.payment_status });
  } catch (error) {
    response.status(error instanceof HotelBookingError ? error.status : 503).json({
      error: error instanceof Error ? error.message : "Unable to confirm hotel payment"
    });
  }
};
const cancelHotelBookingPayment = async (request, response) => {
  try {
    const { txRef, status, accessToken } = request.body;
    if (!txRef?.startsWith("hotel-") || !["cancelled", "failed"].includes(status || "") || !accessToken) {
      throw new HotelBookingError("Payment cancellation details are invalid");
    }
    const attempt = await getAttempt(txRef);
    const booking = await getBooking(attempt.booking_id);
    await assertBookingTenant(request, booking);
    if (createHash("sha256").update(accessToken).digest("hex") !== booking.access_token_hash) throw new HotelBookingError("Booking access could not be verified", 403);
    if (attempt.status !== "completed") {
      await writeService(`hotel_payment_attempts?tx_ref=eq.${encodeURIComponent(txRef)}`, "PATCH", {
        status: status === "cancelled" ? "cancelled" : "failed",
        ...status === "cancelled" ? { cancelled_at: (/* @__PURE__ */ new Date()).toISOString() } : { failure_reason: "Flutterwave returned an unsuccessful payment status" }
      });
    }
    response.json({ paymentStatus: status });
  } catch (error) {
    response.status(error instanceof HotelBookingError ? error.status : 503).json({
      error: error instanceof Error ? error.message : "Unable to record payment status"
    });
  }
};
const handleHotelBookingWebhook = async (request, response) => {
  const signature = request.headers["verif-hash"];
  const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;
  const signatureBytes = typeof signature === "string" ? Buffer.from(signature) : null;
  const secretBytes = secretHash ? Buffer.from(secretHash) : null;
  const signatureIsValid = Boolean(signatureBytes && secretBytes && signatureBytes.length === secretBytes.length && timingSafeEqual(signatureBytes, secretBytes));
  if (!signatureIsValid) return response.status(401).end();
  const payload = request.body;
  if (payload.event !== "charge.completed" || !payload.data?.id) return response.status(200).end();
  if (payload.data.tx_ref?.startsWith("hotel-spa-")) {
    try {
      await verifyHotelSpaPaymentForWebhook(String(payload.data.id), payload.data.tx_ref);
      return response.status(200).end();
    } catch (error) {
      console.error("Hotel spa payment webhook verification failed", error);
      return response.status(500).end();
    }
  }
  if (!payload.data.tx_ref?.startsWith("hotel-")) return response.status(200).end();
  try {
    await verifyHotelPayment(String(payload.data.id), payload.data.tx_ref);
    return response.status(200).end();
  } catch (error) {
    console.error("Hotel payment webhook verification failed", error);
    return response.status(500).end();
  }
};
const getExchangeRates = async (_request, response) => {
  try {
    const result = await fetchAndStoreRates();
    response.setHeader("Cache-Control", "private, max-age=300");
    response.json({ base: "UGX", rates: result.rates, asOf: result.asOf, provider: result.provider });
  } catch (error) {
    console.error("Unable to refresh Books exchange rates", error);
    response.status(503).json({ error: "Exchange rates are temporarily unavailable" });
  }
};
const getConfiguration$1 = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error("Menu checkout database configuration is incomplete");
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), supabaseAnonKey, serviceRoleKey };
};
const getAuthenticatedUserId$1 = async (authorization) => {
  if (!authorization?.startsWith("Bearer ")) return null;
  const { supabaseUrl, supabaseAnonKey } = getConfiguration$1();
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: supabaseAnonKey, Authorization: authorization },
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user.id || null;
};
const createMenuOrder = async (request, response) => {
  try {
    const input = request.body;
    const userId = await getAuthenticatedUserId$1(request.headers.authorization);
    if (!userId) return response.status(401).json({ error: "Please sign in before placing an order." });
    if (!input.idempotencyKey || !/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)) {
      return response.status(400).json({ error: "Checkout request is invalid." });
    }
    if (!Array.isArray(input.items) || !input.items.length || !input.customer) {
      return response.status(400).json({ error: "Add menu items and complete your customer details." });
    }
    if (input.cartId != null && !/^[0-9a-f-]{36}$/i.test(input.cartId)) {
      return response.status(400).json({ error: "Saved cart is invalid." });
    }
    if (typeof input.tipAmount !== "number" || !Number.isFinite(input.tipAmount)) {
      return response.status(400).json({ error: "Tip amount is invalid." });
    }
    const tenant = await resolveRequestHotelTenant(request);
    const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getConfiguration$1();
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_menu_order_for_tenant`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        target_organization_id: tenant.organizationId,
        target_user_id: userId,
        target_items: input.items.map(({ menuItemId, quantity }) => ({ menuItemId, quantity })),
        target_order_type: input.orderType,
        target_payment_method: input.paymentMethod,
        target_tip_amount: input.tipAmount,
        target_customer: input.customer,
        target_cart_id: input.cartId || null,
        target_idempotency_key: input.idempotencyKey
      }),
      signal: AbortSignal.timeout(15e3)
    });
    const payload = await rpcResponse.json().catch(() => null);
    if (!rpcResponse.ok) {
      const message = payload && !Array.isArray(payload) && typeof payload.message === "string" ? payload.message : "The order could not be priced securely.";
      return response.status(rpcResponse.status === 401 ? 401 : 400).json({ error: message });
    }
    const [order] = Array.isArray(payload) ? payload : [];
    if (!order) return response.status(503).json({ error: "The order could not be created." });
    return response.status(201).json(order);
  } catch (error) {
    console.error("Menu order creation failed", error);
    return response.status(503).json({
      error: error instanceof Error ? error.message : "The order could not be created."
    });
  }
};
const getConfiguration = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) throw new Error("Hotel newsletter configuration is incomplete");
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), supabaseAnonKey, serviceRoleKey };
};
const submitHotelNewsletter = async (request, response) => {
  try {
    const tenant = await resolveRequestHotelTenant(request);
    const body = request.body;
    if (body.operation !== "unsubscribe" && (typeof body.email !== "string" || body.consent !== true)) {
      return response.status(400).json({ error: "Enter your email and confirm consent to receive hotel offers" });
    }
    if (body.operation === "unsubscribe" && typeof body.token !== "string") {
      return response.status(400).json({ error: "Unsubscribe link is invalid" });
    }
    const { serviceRoleKey } = getConfiguration();
    const origin = new URL(request.get("origin") || `https://${request.hostname}`);
    const originTenant = await resolveRequestHotelTenant({ hostname: origin.hostname, headers: request.headers });
    if (originTenant.organizationId !== tenant.organizationId) {
      console.warn("Hotel newsletter origin resolved to a different tenant", { requestOrganizationId: tenant.organizationId, originOrganizationId: originTenant.organizationId, origin: origin.hostname });
      return response.status(403).json({ error: "This site address is not registered to the same hotel as its newsletter." });
    }
    const unsubscribeUrl = new URL("/offers", origin);
    const payload = { ...body, organizationId: tenant.organizationId, unsubscribeUrl: unsubscribeUrl.toString() };
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", serviceRoleKey).update(`${timestamp}.${JSON.stringify(payload)}`).digest("hex");
    const functionUrl = process.env.HOTEL_NEWSLETTER_FUNCTION_URL || "https://us-central1-speshio.cloudfunctions.net/hotelOffersNewsletter";
    const result = await fetch(functionUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hotel-newsletter-timestamp": timestamp, "x-hotel-newsletter-signature": signature },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45e3)
    });
    const resultBody = await result.json().catch(() => null);
    if (!result.ok || !resultBody?.ok) return response.status(result.status >= 400 && result.status < 500 ? result.status : 503).json({ error: resultBody?.error || "Newsletter service is temporarily unavailable" });
    response.setHeader("Cache-Control", "private, no-store");
    return response.json(resultBody);
  } catch (error) {
    return response.status(503).json({ error: error instanceof Error ? error.message : "Newsletter service is temporarily unavailable" });
  }
};
const configuration = () => {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) throw new Error("Supabase server configuration is incomplete");
  return { url: url.replace(/\/$/, ""), anonKey, serviceRoleKey };
};
const serviceHeaders = (json = false) => {
  const { anonKey, serviceRoleKey } = configuration();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...json ? { "content-type": "application/json" } : {}
  };
};
const fail = (message, status) => Object.assign(new Error(message), { status });
const getAuthenticatedUserId = async (authorization) => {
  if (!authorization?.startsWith("Bearer ")) throw fail("Authentication is required", 401);
  const { url, anonKey } = configuration();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) throw fail("Your sign-in session has expired", 401);
  const user = await response.json();
  if (!user.id) throw fail("Your sign-in session could not be verified", 401);
  return user.id;
};
const readService = async (path2) => {
  const { url } = configuration();
  const response = await fetch(`${url}/rest/v1/${path2}`, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(15e3)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw fail(body && typeof body === "object" && "message" in body && body.message ? body.message : "Unable to load platform onboarding data", 500);
  }
  return body;
};
const callServiceRpc = async (name, values) => {
  const { url } = configuration();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders(true),
    body: JSON.stringify(values),
    signal: AbortSignal.timeout(2e4)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw fail(body && typeof body === "object" && "message" in body && body.message ? body.message : "Hotel onboarding could not be saved", response.status >= 500 ? 500 : 400);
  }
  return body;
};
const claimBootstrapAdmin = async (authorization) => {
  const { url, anonKey } = configuration();
  const response = await fetch(`${url}/rest/v1/rpc/claim_platform_admin_bootstrap`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: authorization, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(1e4)
  });
  if (!response.ok) throw fail("Admin bootstrap could not be checked", 503);
};
const requirePlatformAdmin = async (request) => {
  const userId = await getAuthenticatedUserId(request.headers.authorization);
  await claimBootstrapAdmin(request.headers.authorization);
  const admins = await readService(
    `platform_admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`
  );
  if (admins.length !== 1) throw fail("Platform administrator access is required", 403);
  return userId;
};
const noStore = (response) => response.setHeader("Cache-Control", "private, no-store");
const sendError = (response, error) => {
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) || 500 : 500;
  response.status(status).json({ error: error instanceof Error ? error.message : "Hotel onboarding failed" });
};
const validDomain = (value) => {
  if (typeof value !== "string") return false;
  const domain = value.trim().toLowerCase();
  if (domain !== value || domain.length > 253 || !domain.includes(".")) return false;
  return domain.split(".").every(
    (label) => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
};
const isUuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const getPlatformAdminStatus = async (request, response) => {
  noStore(response);
  if (!request.headers.authorization?.startsWith("Bearer ")) {
    response.json({ isPlatformAdmin: false });
    return;
  }
  try {
    const userId = await getAuthenticatedUserId(request.headers.authorization);
    await claimBootstrapAdmin(request.headers.authorization);
    const admins = await readService(
      `platform_admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`
    );
    response.json({ isPlatformAdmin: admins.length === 1 });
  } catch (error) {
    sendError(response, error);
  }
};
const getPlatformHotels = async (request, response) => {
  noStore(response);
  try {
    await requirePlatformAdmin(request);
    const [organizations, workerWorkspaces, settings, domains] = await Promise.all([
      readService(
        "books_organizations?select=id,name,country_code,base_currency,owner_id&order=name"
      ),
      readService("books_worker_workspaces?select=organization_id"),
      readService(
        "hotel_tenant_settings?select=organization_id,display_name,logo_url,primary_color,accent_color,booking_title,booking_subtitle,is_active"
      ),
      readService(
        "hotel_tenant_domains?select=domain,organization_id,verification_status,verification_method,verified_at&order=domain"
      )
    ]);
    const workerOrganizationIds = new Set(workerWorkspaces.map((workspace) => workspace.organization_id));
    response.json({
      organizations: organizations.filter((organization) => !workerOrganizationIds.has(organization.id)),
      hotels: settings.map((hotel) => ({
        ...hotel,
        domains: domains.filter((domain) => domain.organization_id === hotel.organization_id)
      }))
    });
  } catch (error) {
    sendError(response, error);
  }
};
const onboardPlatformHotel = async (request, response) => {
  noStore(response);
  try {
    const adminUserId = await requirePlatformAdmin(request);
    const input = request.body;
    const domain = typeof input.domain === "string" ? input.domain.trim().toLowerCase() : "";
    const verificationMethod = input.verificationMethod;
    if (!validDomain(domain)) throw fail("Enter a hostname without a scheme, path, or port", 400);
    if (verificationMethod !== "dns_txt" && verificationMethod !== "vercel_project") {
      throw fail("Choose DNS TXT or a reviewed Vercel hostname", 400);
    }
    if (domain.endsWith(".vercel.app") && verificationMethod !== "vercel_project") {
      throw fail("Vercel hostnames require platform-admin assignment review", 400);
    }
    if (!domain.endsWith(".vercel.app") && verificationMethod === "vercel_project") {
      throw fail("Vercel assignment review is only for .vercel.app hostnames", 400);
    }
    if (input.organizationId !== null && input.organizationId !== void 0 && !isUuid(input.organizationId)) {
      throw fail("Choose a valid organization", 400);
    }
    const challenge = randomBytes(32).toString("base64url");
    const result = await callServiceRpc(
      "platform_admin_onboard_hotel",
      {
        target_admin_user_id: adminUserId,
        target_organization_id: input.organizationId ?? null,
        target_organization_name: input.organizationName,
        target_owner_email: typeof input.ownerEmail === "string" ? input.ownerEmail.trim().toLowerCase() : null,
        target_country_code: input.countryCode,
        target_base_currency: input.baseCurrency,
        target_display_name: input.displayName,
        target_booking_title: input.bookingTitle,
        target_booking_subtitle: input.bookingSubtitle,
        target_logo_url: input.logoUrl ?? null,
        target_primary_color: input.primaryColor ?? null,
        target_accent_color: input.accentColor ?? null,
        target_domain: domain,
        target_challenge_hash: sha256(challenge),
        target_verification_method: verificationMethod
      }
    );
    const hotel = Array.isArray(result) ? result[0] : null;
    if (!hotel) throw new Error("Hotel onboarding did not return a result");
    response.status(201).json({
      organizationId: hotel.organization_id,
      domain: hotel.domain,
      verificationStatus: hotel.verification_status,
      verificationMethod,
      dnsTxtName: verificationMethod === "dns_txt" ? `_hotel-verify.${hotel.domain}` : null,
      dnsTxtValue: verificationMethod === "dns_txt" && hotel.verification_status !== "verified" ? `hotel-domain-verification=${challenge}` : null
    });
  } catch (error) {
    sendError(response, error);
  }
};
const verifyPlatformHotelDomain = async (request, response) => {
  noStore(response);
  try {
    const adminUserId = await requirePlatformAdmin(request);
    const input = request.body;
    const domain = typeof input.domain === "string" ? input.domain.trim().toLowerCase() : "";
    if (!validDomain(domain)) throw fail("Enter a valid hostname", 400);
    const rows = await readService(
      `hotel_tenant_domains?domain=eq.${encodeURIComponent(domain)}&select=domain,organization_id,verification_status,verification_method,verification_challenge_hash,verification_expires_at&limit=1`
    );
    const pendingDomain = rows[0];
    if (!pendingDomain) throw fail("This hostname has not been submitted for onboarding", 404);
    if (pendingDomain.verification_status === "verified") {
      response.json({ verified: true, domain });
      return;
    }
    if (!["pending", "legacy"].includes(pendingDomain.verification_status) || !pendingDomain.verification_expires_at || new Date(pendingDomain.verification_expires_at).getTime() <= Date.now()) {
      throw fail("This verification challenge has expired. Submit the hostname again to generate a new one.", 400);
    }
    if (domain.endsWith(".vercel.app") && pendingDomain.verification_method !== "vercel_project") {
      throw fail("Vercel hostnames require platform-admin assignment review", 400);
    }
    if (!domain.endsWith(".vercel.app") && pendingDomain.verification_method === "vercel_project") {
      throw fail("Vercel assignment review is only for .vercel.app hostnames", 400);
    }
    if (pendingDomain.verification_method === "dns_txt") {
      let records;
      try {
        records = await resolveTxt(`_hotel-verify.${domain}`);
      } catch {
        throw fail(`DNS TXT record not found yet. Add the record at _hotel-verify.${domain} and retry.`, 400);
      }
      const matches = records.flatMap((record) => record.join("")).some((record) => {
        const value = record.startsWith("hotel-domain-verification=") ? record.slice("hotel-domain-verification=".length) : "";
        if (!value || !pendingDomain.verification_challenge_hash) return false;
        const actual = Buffer.from(sha256(value), "hex");
        const expected = Buffer.from(pendingDomain.verification_challenge_hash, "hex");
        return actual.length === expected.length && timingSafeEqual(actual, expected);
      });
      if (!matches) throw fail("The DNS TXT record does not match the verification challenge yet", 400);
    } else if (pendingDomain.verification_method === "vercel_project") {
      const productionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL?.toLowerCase();
      if (!domain.endsWith(".vercel.app") || domain !== productionDomain && input.confirmVercelAssignment !== true) {
        throw fail("Confirm that this exact Vercel hostname is assigned to the project", 400);
      }
    } else {
      throw fail("This hostname has no supported verification method", 400);
    }
    const verified = await callServiceRpc("platform_admin_record_domain_verification", {
      target_admin_user_id: adminUserId,
      target_domain: domain,
      target_organization_id: pendingDomain.organization_id,
      target_verification_method: pendingDomain.verification_method
    });
    if (!verified) throw fail("The hostname could not be marked verified", 409);
    response.json({ verified: true, domain, organizationId: pendingDomain.organization_id });
  } catch (error) {
    sendError(response, error);
  }
};
const activatePlatformHotel = async (request, response) => {
  noStore(response);
  try {
    const adminUserId = await requirePlatformAdmin(request);
    const { organizationId } = request.body;
    if (!isUuid(organizationId)) throw fail("Choose a valid hotel", 400);
    await callServiceRpc("platform_admin_activate_hotel", {
      target_admin_user_id: adminUserId,
      target_organization_id: organizationId
    });
    response.json({ active: true });
  } catch (error) {
    sendError(response, error);
  }
};
function createServer() {
  const app2 = express__default();
  app2.use(cors());
  app2.use(express__default.json());
  app2.use(express__default.urlencoded({ extended: true }));
  app2.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });
  app2.get("/api/demo", handleDemo);
  app2.get("/api/platform/admin-status", getPlatformAdminStatus);
  app2.get("/api/platform/hotels", getPlatformHotels);
  app2.post("/api/platform/hotels", onboardPlatformHotel);
  app2.post("/api/platform/hotels/verify-domain", verifyPlatformHotelDomain);
  app2.post("/api/platform/hotels/activate", activatePlatformHotel);
  app2.get("/api/hotel-tenant", getHotelTenant);
  app2.get("/api/hotel-rewards", getHotelRewards);
  app2.post("/api/hotel-rewards/enrollment", updateHotelRewardsEnrollment);
  app2.post("/api/hotel-complaints", submitHotelComplaint);
  app2.get("/api/hotel-booking-data", getPublicHotelBookingData);
  app2.get("/api/hotel-offers", getPublicHotelOffers);
  app2.post("/api/hotel-newsletter", submitHotelNewsletter);
  app2.get("/api/hotel-spa/services", getHotelSpaServices);
  app2.get("/api/hotel-spa/availability", getHotelSpaAvailability);
  app2.get("/api/hotel-spa/manage", getHotelSpaServicesForManagement);
  app2.post("/api/hotel-spa/manage", saveHotelSpaService);
  app2.delete("/api/hotel-spa/manage", deleteHotelSpaService);
  app2.post("/api/hotel-spa/bookings", createHotelSpaBooking);
  app2.post("/api/payments/hotel-spa/session", createHotelSpaPaymentSession);
  app2.post("/api/payments/hotel-spa/verify", verifyHotelSpaPayment);
  app2.post("/api/payments/hotel-spa/cancel", cancelHotelSpaPayment);
  app2.get("/api/hotel-offers/manage/access", checkHotelOfferManagementAccess);
  app2.get("/api/hotel-offers/manage", getHotelOffersForManagement);
  app2.post("/api/hotel-offers/manage", saveHotelOffer);
  app2.get("/api/hotel-menu-items", getPublicMenuItems);
  app2.get("/api/hotel-menu-video/:attachmentId", getPublicMenuVideo);
  app2.post("/api/hotel-menu-availability", requestHotelMenuAvailability);
  app2.get("/api/hotel-events", getPublicSpecialEvents);
  app2.post("/api/hotel-worker-binding", bindWorkerToHotelTenant);
  app2.post("/api/hotel-event-proposals/submit", submitHotelEventProposal);
  app2.post("/api/hotel-event-proposals/review", reviewHotelEventProposal);
  app2.post("/api/hotel-event-proposals/respond", respondHotelEventProposal);
  app2.post("/api/hotel-event-proposals/publish", publishHotelEventProposal);
  app2.post("/api/hotel-event-proposals/delete", deleteHotelEventProposal);
  app2.post("/api/hotel-availability", getTenantRoomAvailability);
  app2.post("/api/special-events/bookings/create", createSpecialEventBooking);
  app2.post("/api/special-events/bookings/confirm-free", confirmFreeSpecialEventBooking);
  app2.post("/api/payments/flutterwave/hosted-session", createFlutterwaveHostedSession);
  app2.post("/api/payments/flutterwave/cancel", cancelFlutterwavePayment);
  app2.post("/api/payments/flutterwave/verify", verifyFlutterwavePayment);
  app2.post("/api/payments/flutterwave/webhook", handleFlutterwaveWebhook);
  app2.post("/api/payments/special-events/session", prepareSpecialEventPayment);
  app2.post("/api/payments/special-events/verify", verifySpecialEventPayment);
  app2.post("/api/payments/special-events/cancel", cancelSpecialEventPayment);
  app2.post("/api/payments/special-events/webhook", handleSpecialEventWebhook);
  app2.post("/api/menu-orders/create", createMenuOrder);
  app2.post("/api/hotel-bookings/create", createHotelBooking);
  app2.post("/api/hotel-bookings/recover", recoverHotelBooking);
  app2.post("/api/hotel-bookings/cancel-hold", cancelHotelBookingHold);
  app2.post("/api/payments/hotel/session", createHotelPaymentSession);
  app2.post("/api/payments/hotel/verify", verifyHotelBookingPayment);
  app2.post("/api/payments/hotel/cancel", cancelHotelBookingPayment);
  app2.post("/api/payments/hotel/webhook", handleHotelBookingWebhook);
  app2.get("/api/books/fx-rates", getExchangeRates);
  return app2;
}
const app = createServer();
const port = process.env.PORT || 3e3;
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(distPath, "index.html"));
});
app.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
//# sourceMappingURL=node-build.mjs.map
