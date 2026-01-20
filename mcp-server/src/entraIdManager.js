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
    // Check if the user is a guest user (contains #EXT# in UPN)
    if (userId.includes("#EXT#")) {
      return {
        success: false,
        message: `Cannot disable guest user ${userId}. Guest users with external identities are protected from disabling operations.`,
      };
    }

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

  /**
   * Search for users by display name in EntraID
   * @param {string} displayName - Full or partial display name to search for
   * @returns {Promise<Object>} List of matching users
   */
  async searchUserByName(displayName) {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/users?$filter=startswith(displayName,'${displayName}')&$select=id,userPrincipalName,displayName,accountEnabled`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const users = response.data.value || [];
      return {
        success: true,
        count: users.length,
        users: users.map(user => ({
          id: user.id,
          userPrincipalName: user.userPrincipalName,
          displayName: user.displayName,
          accountEnabled: user.accountEnabled,
        })),
      };
    } catch (error) {
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        "Unknown error";
      throw new Error(`Failed to search users by name ${displayName}: ${message}`);
    }
  }

  /**
   * Enable a user by display name (finds the first match)
   * @param {string} displayName - Display name of the user to enable
   * @returns {Promise<Object>} Result of the operation
   */
  async enableUserByName(displayName) {
    try {
      const searchResult = await this.searchUserByName(displayName);
      
      if (!searchResult.success || searchResult.count === 0) {
        return {
          success: false,
          message: `No users found with display name matching "${displayName}"`,
        };
      }

      if (searchResult.count > 1) {
        return {
          success: false,
          message: `Multiple users found matching "${displayName}". Please be more specific or use the exact UPN.`,
          users: searchResult.users,
        };
      }

      const user = searchResult.users[0];
      return await this.enableUser(user.userPrincipalName);
    } catch (error) {
      const message = error.message || "Unknown error";
      throw new Error(`Failed to enable user by name ${displayName}: ${message}`);
    }
  }

  /**
   * Disable a user by display name (finds the first match)
   * @param {string} displayName - Display name of the user to disable
   * @returns {Promise<Object>} Result of the operation
   */
  async disableUserByName(displayName) {
    try {
      const searchResult = await this.searchUserByName(displayName);
      
      if (!searchResult.success || searchResult.count === 0) {
        return {
          success: false,
          message: `No users found with display name matching "${displayName}"`,
        };
      }

      if (searchResult.count > 1) {
        return {
          success: false,
          message: `Multiple users found matching "${displayName}". Please be more specific or use the exact UPN.`,
          users: searchResult.users,
        };
      }

      const user = searchResult.users[0];
      
      // Check if the user is a guest user before attempting to disable
      if (user.userPrincipalName.includes("#EXT#")) {
        return {
          success: false,
          message: `Cannot disable guest user ${user.userPrincipalName}. Guest users with external identities are protected from disabling operations.`,
        };
      }
      
      return await this.disableUser(user.userPrincipalName);
    } catch (error) {
      const message = error.message || "Unknown error";
      throw new Error(`Failed to disable user by name ${displayName}: ${message}`);
    }
  }
}
