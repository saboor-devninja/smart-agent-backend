const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { uploadBufferToS3 } = require("./s3");

let tokenCache = null;

function normalizePrivateKey() {
  const privateKey = config.docusign.privateKeyB64;
  if (!privateKey) {
    throw new Error("DS_PRIVATE_KEY_B64 environment variable is not configured");
  }

  let key = privateKey.trim();

  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n");

  if (key.includes("BEGIN") && key.includes("END")) {
    return key;
  }

  const cleanBase64 = key.replace(/\s+/g, "");
  const formatted = cleanBase64.match(/.{1,64}/g)?.join("\n") || cleanBase64;
  const header = "RSA PRIVATE KEY";

  return `-----BEGIN ${header}-----\n${formatted}\n-----END ${header}-----`;
}

async function getJwtAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const integrationKey = config.docusign.integrationKey;
  const userId = config.docusign.userId;
  const privateKey = config.docusign.privateKeyB64;
  const oauthBase = config.docusign.oauthBase;

  if (!integrationKey) {
    throw new Error("DS_INTEGRATION_KEY environment variable is not configured");
  }
  if (!userId) {
    throw new Error("DS_USER_ID environment variable is not configured");
  }
  if (!privateKey) {
    throw new Error("DS_PRIVATE_KEY_B64 environment variable is not configured");
  }

  try {
    const pemKey = normalizePrivateKey();
    const now = Math.floor(Date.now() / 1000);

    const assertion = jwt.sign(
      {
        iss: integrationKey,
        sub: userId,
        aud: new URL(oauthBase).hostname,
        iat: now,
        exp: now + 300,
        scope: "signature impersonation",
      },
      pemKey,
      { algorithm: "RS256" }
    );

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assertion,
    });

    const response = await fetch(`${oauthBase}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errorMessage = `JWT token exchange failed (${response.status})`;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage += `: ${errorJson.error || "Unknown error"}`;
        if (errorJson.error_description) {
          errorMessage += ` - ${errorJson.error_description}`;
        }
      } catch {
        errorMessage += `: ${responseText}`;
      }

      if (response.status === 400 && responseText.includes("consent_required")) {
        throw new Error(
          `DocuSign consent required. Please grant consent by visiting: ${oauthBase}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${integrationKey}&redirect_uri=https://localhost`
        );
      }

      throw new Error(errorMessage);
    }

    const json = JSON.parse(responseText);
    const accessToken = json.access_token;
    const expiresIn = json.expires_in || 3600;

    tokenCache = {
      token: accessToken,
      expiresAt: Date.now() + (expiresIn - 60) * 1000,
    };

    return accessToken;
  } catch (error) {
    console.error("Failed to obtain DocuSign access token:", error);
    throw error;
  }
}

async function getUserInfo(accessToken) {
  const oauthBase = config.docusign.oauthBase;
  const response = await fetch(`${oauthBase}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`userinfo failed: ${response.status} ${await response.text()}`);
  }
  return await response.json();
}

async function getBaseUriAndAccountId() {
  const accessToken = await getJwtAccessToken();
  const info = await getUserInfo(accessToken);
  const accountId = config.docusign.accountId;
  const acct =
    info.accounts?.find((a) => a.account_id === accountId) ||
    info.accounts?.find((a) => a.is_default) ||
    info.accounts?.[0];
  if (!acct) {
    throw new Error("No DocuSign account found on userinfo");
  }
  const baseUri = `${acct.base_uri.replace(/\/+$/, "")}/restapi`;
  return { accessToken, accountId: acct.account_id, baseUri };
}

async function createEnvelopeFromDocument(params) {
  const { fileName, fileBase64, landlord, tenant, emailSubject } = params;
  const { accessToken, accountId, baseUri } = await getBaseUriAndAccountId();

  const envelope = {
    emailSubject: emailSubject || "Lease agreement for signature",
    documents: [
      {
        documentBase64: fileBase64,
        name: fileName,
        fileExtension: fileName.split(".").pop() || "pdf",
        documentId: "1",
      },
    ],
    recipients: {
      signers: [
        {
          email: landlord.email,
          name: landlord.name,
          recipientId: "1",
          routingOrder: "1",
          clientUserId: "landlord",
          tabs: {
            signHereTabs: [
              { documentId: "1", pageNumber: "1", xPosition: "100", yPosition: "500" },
            ],
          },
        },
        {
          email: tenant.email,
          name: tenant.name,
          recipientId: "2",
          routingOrder: "1",
          clientUserId: "tenant",
          tabs: {
            signHereTabs: [
              { documentId: "1", pageNumber: "1", xPosition: "100", yPosition: "600" },
            ],
          },
        },
      ],
    },
    status: "sent",
  };

  const response = await fetch(`${baseUri}/v2.1/accounts/${accountId}/envelopes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(envelope),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`createEnvelope failed: ${response.status} ${errorText}`);
  }

  const json = await response.json();
  return { envelopeId: json.envelopeId, accountId, baseUri, accessToken };
}

async function getEnvelopeRecipients(envelopeId) {
  const { accessToken, accountId, baseUri } = await getBaseUriAndAccountId();
  const response = await fetch(
    `${baseUri}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/recipients`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) {
    throw new Error(`getEnvelopeRecipients failed: ${response.status} ${await response.text()}`);
  }
  return await response.json();
}

async function createRecipientViewUrl(params) {
  const { envelopeId, name, email, clientUserId } = params;
  const { accessToken, accountId, baseUri } = await getBaseUriAndAccountId();
  const appBaseUrl = config.app.baseUrl;

  try {
    const recipients = await getEnvelopeRecipients(envelopeId);
    const signers = recipients.signers || [];

    const currentSigner = signers.find((s) => s.clientUserId === clientUserId);
    if (!currentSigner) {
      throw new Error(`Recipient with clientUserId '${clientUserId}' not found in envelope`);
    }

    if (currentSigner.status === "completed") {
      throw new Error("This recipient has already signed the document");
    }

    const currentRoutingOrder = parseInt(currentSigner.routingOrder);
    for (const signer of signers) {
      const signerRoutingOrder = parseInt(signer.routingOrder);
      if (signerRoutingOrder < currentRoutingOrder && signer.status !== "completed") {
        throw new Error(
          `Previous signer '${signer.name}' must complete signing first (routing order ${signer.routingOrder})`
        );
      }
    }
  } catch (error) {
    throw error;
  }

  const body = {
    authenticationMethod: "none",
    email: email,
    userName: name,
    clientUserId: clientUserId,
    returnUrl: `${appBaseUrl}/docusign/return?envelopeId=${envelopeId}&event=signing_complete`,
  };

  const response = await fetch(
    `${baseUri}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`createRecipientView failed: ${response.status} ${await response.text()}`);
  }

  const json = await response.json();
  return json.url;
}

module.exports = {
  getJwtAccessToken,
  getUserInfo,
  getBaseUriAndAccountId,
  createEnvelopeFromDocument,
  getEnvelopeRecipients,
  createRecipientViewUrl,
};

