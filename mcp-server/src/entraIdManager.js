import { ClientSecretCredential } from "@azure/identity";
import axios from "axios";

export class EntraIDManager {
  constructor({ tenantId, clientId, clientSecret }) {
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error(
        "Missing required credentials: tenantId, clientId, clientSecret"
      );
    }

    this.tenantId = tenantId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    );
  }

  /**
   * Get an access token for Microsoft Graph API
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    const tokenResponse = await this.credential.getToken(
      "https://graph.microsoft.com/.default"
    );
    return tokenResponse.token;
  }

  /**
   * Enable a user account in EntraID
   * @param {string} userId - User ID (GUID) or User Principal Name (UPN)
   * @returns {Promise<Object>} Result of the operation
   */
  async enableUser(userId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.patch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}`,
        { accountEnabled: true },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const user = response.data;
      return {
        success: true,
        message: `User ${userId} has been enabled`,
        user: {
          id: user.id,
          userPrincipalName: user.userPrincipalName,
          displayName: user.displayName,
          accountEnabled: user.accountEnabled,
        },
      };
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        "Unknown error";
      throw new Error(`Failed to enable user ${userId}: ${message}`);
    }
  }

  /**
   * Disable a user account in EntraID
   * @param {string} userId - User ID (GUID) or User Principal Name (UPN)
   * @returns {Promise<Object>} Result of the operation
   */
  async disableUser(userId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.patch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}`,
        { accountEnabled: false },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const user = response.data;
      return {
        success: true,
        message: `User ${userId} has been disabled`,
        user: {
          id: user.id,
          userPrincipalName: user.userPrincipalName,
          displayName: user.displayName,
          accountEnabled: user.accountEnabled,
        },
      };
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        "Unknown error";
      throw new Error(`Failed to disable user ${userId}: ${message}`);
    }
  }

  /**
   * Get the account status of a user in EntraID
   * @param {string} userId - User ID (GUID) or User Principal Name (UPN)
   * @returns {Promise<Object>} User account status
   */
  async getUserStatus(userId) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}?$select=id,userPrincipalName,displayName,accountEnabled`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const user = response.data;
      return {
        success: true,
        user: {
          id: user.id,
          userPrincipalName: user.userPrincipalName,
          displayName: user.displayName,
          accountEnabled: user.accountEnabled,
        },
      };
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        "Unknown error";
      throw new Error(`Failed to get user status for ${userId}: ${message}`);
    }
  }
}
