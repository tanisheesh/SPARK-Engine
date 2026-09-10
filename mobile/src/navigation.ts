/* Route table. Four screens, one stack - the phone's whole information
   architecture. The desktop's sidebar and Studio deliberately have no
   equivalent here; on this screen size they would crowd out the one thing the
   app is for. */

export type RootStackParams = {
  Conversations: undefined;
  Conversation: {
    /** null starts a new conversation; the engine assigns the real id. */
    conversationId: string | null;
    title?: string;
  };
  Account: undefined;
};
